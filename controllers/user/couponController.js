// Coupon controller for handling coupon application and validation
const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");


// Apply coupon to checkout
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        const { couponCode, cartTotal } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to continue"
            });
        }

        // Validate input
        if (!couponCode || !cartTotal) {
            return res.status(400).json({
                success: false,
                message: "Coupon code and cart total are required"
            });
        }

        // Find the coupon by name (case-insensitive)
        const coupon = await Coupon.findOne({
            name: { $regex: new RegExp(`^${couponCode}$`, 'i') },
            islist: true
        }).populate('applicableCategories applicableProducts');

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid coupon code"
            });
        }

        // Check if coupon has started
        const currentDate = new Date();
        if (coupon.startDate && coupon.startDate > currentDate) {
            return res.status(400).json({
                success: false,
                message: "This coupon is not yet active"
            });
        }

        // Check if coupon is expired
        if (coupon.expireOn < currentDate) {
            return res.status(400).json({
                success: false,
                message: "This coupon has expired"
            });
        }

        // Check minimum order amount
        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount of ₹${coupon.minimumPrice.toLocaleString('en-IN')} required for this coupon`
            });
        }

        // Check total usage limit
        if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
            return res.status(400).json({
                success: false,
                message: "This coupon has reached its usage limit"
            });
        }

        // Check per-user usage limit
        const userUsageCount = await Order.countDocuments({
            userId: userId,
            couponCode: coupon.name,
            status: { $ne: 'Cancelled' } // Don't count cancelled orders
        });

        const maxUsesPerUser = coupon.maxUsesPerUser || 1; // Default to 1 for backward compatibility
        if (userUsageCount >= maxUsesPerUser) {
            return res.status(400).json({
                success: false,
                message: `You have reached the maximum usage limit (${maxUsesPerUser}) for this coupon`
            });
        }

        // Validate category and product applicability
       
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'category',
                select: '_id name'
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        // Check category applicability
        if (!coupon.isAllCategories && coupon.applicableCategories.length > 0) {
            const cartCategoryIds = cart.items.map(item => item.productId.category._id.toString());
            const applicableCategoryIds = coupon.applicableCategories.map(cat => cat._id.toString());

            const hasApplicableCategory = cartCategoryIds.some(catId =>
                applicableCategoryIds.includes(catId)
            );

            if (!hasApplicableCategory) {
                return res.status(400).json({
                    success: false,
                    message: "This coupon is not applicable to items in your cart"
                });
            }
        }

        // Check product applicability
        if (!coupon.isAllProducts && coupon.applicableProducts.length > 0) {
            const cartProductIds = cart.items.map(item => item.productId._id.toString());
            const applicableProductIds = coupon.applicableProducts.map(prod => prod._id.toString());

            const hasApplicableProduct = cartProductIds.some(prodId =>
                applicableProductIds.includes(prodId)
            );

            if (!hasApplicableProduct) {
                return res.status(400).json({
                    success: false,
                    message: "This coupon is not applicable to items in your cart"
                });
            }
        }

        // Calculate discount amount based on discount type
        let discountAmount;
        if (coupon.discountType === 'percentage') {
            discountAmount = Math.min((cartTotal * coupon.offerPrice) / 100, cartTotal);
        } else {
            discountAmount = Math.min(coupon.offerPrice, cartTotal);
        }

        const finalAmount = cartTotal - discountAmount;

        // Store coupon in session for checkout process
        req.session.appliedCoupon = {
            couponId: coupon._id,
            couponCode: coupon.name,
            discountAmount: discountAmount,
            originalAmount: cartTotal,
            finalAmount: finalAmount
        };

        res.json({
            success: true,
            message: "Coupon applied successfully!",
            couponCode: coupon.name,
            discountAmount: discountAmount,
            originalAmount: cartTotal,
            finalAmount: finalAmount
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to apply coupon"
        });
    }
};

// Remove applied coupon
const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to continue"
            });
        }

        // Remove coupon from session
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
        }

        res.json({
            success: true,
            message: "Coupon removed successfully"
        });

    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove coupon"
        });
    }
};

// Validate coupon during checkout
const validateCouponForCheckout = async (couponData, userId) => {
    try {
        if (!couponData || !couponData.couponId) {
            return { valid: false, message: "No coupon applied" };
        }

        // Find the coupon
        const coupon = await Coupon.findById(couponData.couponId)
            .populate('applicableCategories applicableProducts');
        if (!coupon || !coupon.islist) {
            return { valid: false, message: "Coupon is no longer valid" };
        }

        // Check if coupon has started
        const currentDate = new Date();
        if (coupon.startDate && coupon.startDate > currentDate) {
            return { valid: false, message: "Coupon is not yet active" };
        }

        // Check expiration
        if (coupon.expireOn < currentDate) {
            return { valid: false, message: "Coupon has expired" };
        }

        // Check total usage limit
        if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
            return { valid: false, message: "Coupon has reached its usage limit" };
        }

        // Check per-user usage limit
        const userUsageCount = await Order.countDocuments({
            userId: userId,
            couponCode: coupon.name,
            status: { $ne: 'Cancelled' } // Don't count cancelled orders
        });

        const maxUsesPerUser = coupon.maxUsesPerUser || 1; // Default to 1 for backward compatibility
        if (userUsageCount >= maxUsesPerUser) {
            return { valid: false, message: `Maximum usage limit (${maxUsesPerUser}) reached for this coupon` };
        }

        // Validate category and product applicability
        const Cart = require("../../models/cartSchema");
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'category',
                select: '_id name'
            }
        });

        if (!cart || cart.items.length === 0) {
            return { valid: false, message: "Cart is empty" };
        }

        // Check category applicability
        if (!coupon.isAllCategories && coupon.applicableCategories.length > 0) {
            const cartCategoryIds = cart.items.map(item => item.productId.category._id.toString());
            const applicableCategoryIds = coupon.applicableCategories.map(cat => cat._id.toString());

            const hasApplicableCategory = cartCategoryIds.some(catId =>
                applicableCategoryIds.includes(catId)
            );

            if (!hasApplicableCategory) {
                return { valid: false, message: "Coupon not applicable to cart items" };
            }
        }

        // Check product applicability
        if (!coupon.isAllProducts && coupon.applicableProducts.length > 0) {
            const cartProductIds = cart.items.map(item => item.productId._id.toString());
            const applicableProductIds = coupon.applicableProducts.map(prod => prod._id.toString());

            const hasApplicableProduct = cartProductIds.some(prodId =>
                applicableProductIds.includes(prodId)
            );

            if (!hasApplicableProduct) {
                return { valid: false, message: "Coupon not applicable to cart items" };
            }
        }

        return { valid: true, coupon: coupon };

    } catch (error) {
        console.error("Error validating coupon:", error);
        return { valid: false, message: "Coupon validation failed" };
    }
};

// Mark coupon as used by user
const markCouponAsUsed = async (couponId, userId) => {
    try {
        // Update both the userId array (for backward compatibility) and increment currentUsageCount
        await Coupon.findByIdAndUpdate(
            couponId,
            {
                $addToSet: { userId: userId },
                $inc: { currentUsageCount: 1 }
            }
        );
        return true;
    } catch (error) {
        console.error("Error marking coupon as used:", error);
        return false;
    }
};

// Get applied coupon from session
const getAppliedCoupon = (req, res) => {
    try {
        const appliedCoupon = req.session.appliedCoupon || null;

        res.json({
            success: true,
            appliedCoupon: appliedCoupon
        });

    } catch (error) {
        console.error("Error getting applied coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get coupon information"
        });
    }
};

// Get available coupons for user
const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to continue"
            });
        }

        const currentDate = new Date();

        // Find all active, non-expired coupons that have started
        const allCoupons = await Coupon.find({
            islist: true,
            startDate: { $lte: currentDate },
            expireOn: { $gte: currentDate }
        }).select('name offerPrice minimumPrice expireOn discountType maxUsesPerUser totalUsageLimit currentUsageCount').sort({ expireOn: 1 });

        // Check usage limits for each coupon
        const availableCoupons = [];

        for (const coupon of allCoupons) {
            // Check total usage limit first
            if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
                continue; // Skip this coupon as it has reached total usage limit
            }

            // Count how many times this user has used this specific coupon
            const userUsageCount = await Order.countDocuments({
                userId: userId,
                couponCode: coupon.name,
                status: { $ne: 'Cancelled' } // Don't count cancelled orders
            });

            // Check if user has reached their usage limit for this coupon
            const maxUsesPerUser = coupon.maxUsesPerUser || 1; // Default to 1 for backward compatibility
            if (userUsageCount < maxUsesPerUser) {
                availableCoupons.push(coupon);
            }
        }

        // Format coupons for display
        const formattedCoupons = availableCoupons.map(coupon => ({
            _id: coupon._id,
            name: coupon.name,
            offerPrice: coupon.offerPrice,
            minimumPrice: coupon.minimumPrice,
            expireOn: coupon.expireOn,
            discountType: coupon.discountType,
            maxUsesPerUser: coupon.maxUsesPerUser || 1,
            displayText: coupon.discountType === 'percentage'
                ? `${coupon.offerPrice}% OFF`
                : `₹${coupon.offerPrice} OFF`
        }));

        res.json({
            success: true,
            coupons: formattedCoupons
        });

    } catch (error) {
        console.error("Error fetching available coupons:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch available coupons"
        });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon,
    validateCouponForCheckout,
    markCouponAsUsed,
    getAppliedCoupon,
    getAvailableCoupons
};
