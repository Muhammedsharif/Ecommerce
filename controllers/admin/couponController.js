// Admin coupon controller for comprehensive coupon management
const Coupon = require("../../models/couponSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

// Controller function to render the add coupon page
const getAddCouponPage = async (req, res) => {
    try {
        res.render("admin-add-coupon");
    } catch (error) {
        console.error("Error loading add coupon page:", error);
        res.redirect("/admin/pageerror");
    }
};

// Controller function to handle coupon creation
const addCoupon = async (req, res) => {
    try {
        const {
            name,
            offerPrice,
            minimumPrice,
            startDate,
            expireOn,
            discountType,
            applicableCategories,
            applicableProducts,
            isAllCategories,
            isAllProducts,
            maxUsesPerUser,
            totalUsageLimit,
            islist
        } = req.body;

        // Validate required fields
        if (!name || !offerPrice || !minimumPrice || !startDate || !expireOn || !discountType) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Check if coupon code already exists (case-insensitive)
        const existingCoupon = await Coupon.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Coupon code already exists. Please use a different code."
            });
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const expirationDate = new Date(expireOn);
        const currentDate = new Date();

        if (startDateObj < currentDate.setHours(0, 0, 0, 0)) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be in the past"
            });
        }

        if (expirationDate <= startDateObj) {
            return res.status(400).json({
                success: false,
                message: "Expiration date must be after start date"
            });
        }

        // Validate discount type and amount
        if (!['flat', 'percentage'].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discount type"
            });
        }

        const offerPriceNum = parseFloat(offerPrice);
        if (offerPriceNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Discount amount must be greater than 0"
            });
        }

        if (discountType === 'percentage' && offerPriceNum > 100) {
            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100%"
            });
        }

        // Validate usage limits
        const maxUsesPerUserNum = parseInt(maxUsesPerUser) || 1;
        if (maxUsesPerUserNum < 1) {
            return res.status(400).json({
                success: false,
                message: "Maximum uses per user must be at least 1"
            });
        }

        const totalUsageLimitNum = totalUsageLimit ? parseInt(totalUsageLimit) : null;
        if (totalUsageLimitNum && totalUsageLimitNum < 1) {
            return res.status(400).json({
                success: false,
                message: "Total usage limit must be at least 1"
            });
        }

        // Validate that maxUsesPerUser is not greater than totalUsageLimit
        if (totalUsageLimitNum && maxUsesPerUserNum > totalUsageLimitNum) {
            return res.status(400).json({
                success: false,
                message: "Maximum uses per user cannot be greater than total usage limit"
            });
        }

        if (parseFloat(minimumPrice) < 0) {
            return res.status(400).json({
                success: false,
                message: "Minimum order amount cannot be negative"
            });
        }

        // Validate category/product selection
        if (!isAllCategories && (!applicableCategories || applicableCategories.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one category or choose 'Apply to All Categories'"
            });
        }

        if (!isAllProducts && (!applicableProducts || applicableProducts.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one product or choose 'Apply to All Products'"
            });
        }

        // Create new coupon
        const newCoupon = new Coupon({
            name: name.toUpperCase().trim(),
            startDate: startDateObj,
            expireOn: expirationDate,
            discountType: discountType,
            offerPrice: offerPriceNum,
            minimumPrice: parseFloat(minimumPrice),
            applicableCategories: isAllCategories ? [] : (Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories]),
            applicableProducts: isAllProducts ? [] : (Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts]),
            isAllCategories: isAllCategories === 'true' || isAllCategories === true,
            isAllProducts: isAllProducts === 'true' || isAllProducts === true,
            maxUsesPerUser: maxUsesPerUserNum,
            totalUsageLimit: totalUsageLimitNum,
            currentUsageCount: 0,
            islist: islist === 'true' || islist === true,
            userId: [] // Initialize empty usage array
        });

        await newCoupon.save();

        res.status(200).json({
            success: true,
            message: "Coupon created successfully!"
        });

    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create coupon. Please try again."
        });
    }
};

// Controller function to get all coupons with pagination, search, and filtering
const getCouponListPage = async (req, res) => {
    try {
        // Extract query parameters for pagination, search, and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const status = req.query.status || "";
        const sortBy = req.query.sortBy || "createdOn";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        // Build search and filter query
        let matchQuery = {};

        // Status filter
        if (status && status !== "all") {
            if (status === "active") {
                matchQuery.islist = true;
            } else if (status === "inactive") {
                matchQuery.islist = false;
            } else if (status === "expired") {
                matchQuery.expireOn = { $lt: new Date() };
            } else if (status === "valid") {
                matchQuery.expireOn = { $gte: new Date() };
                matchQuery.islist = true;
            }
        }

        // Search query
        let searchQuery = {};
        if (search) {
            searchQuery = {
                $or: [
                    { name: { $regex: new RegExp(".*" + search + ".*", "i") } }
                ]
            };
        }

        // Combine match and search queries
        const finalQuery = { ...matchQuery, ...searchQuery };

        // Get coupons with pagination
        const coupons = await Coupon.find(finalQuery)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for pagination
        const totalCoupons = await Coupon.countDocuments(finalQuery);
        const totalPages = Math.ceil(totalCoupons / limit);

        // Calculate coupon statistics
        const currentDate = new Date();
        const couponStats = await Coupon.aggregate([
            {
                $group: {
                    _id: null,
                    totalCoupons: { $sum: 1 },
                    activeCoupons: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$islist", true] }, { $gte: ["$expireOn", currentDate] }] },
                                1,
                                0
                            ]
                        }
                    },
                    expiredCoupons: {
                        $sum: {
                            $cond: [{ $lt: ["$expireOn", currentDate] }, 1, 0]
                        }
                    },
                    inactiveCoupons: {
                        $sum: {
                            $cond: [{ $eq: ["$islist", false] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const stats = couponStats.length > 0 ? couponStats[0] : {
            totalCoupons: 0,
            activeCoupons: 0,
            expiredCoupons: 0,
            inactiveCoupons: 0
        };

        // Add usage count and status to each coupon
        const couponsWithDetails = coupons.map(coupon => {
            const isExpired = new Date(coupon.expireOn) < currentDate;
            const isActive = coupon.islist && !isExpired;
            
            return {
                ...coupon,
                usageCount: coupon.currentUsageCount || 0,
                status: isExpired ? 'Expired' : (isActive ? 'Active' : 'Inactive'),
                isExpired: isExpired
            };
        });

        res.render("admin-coupon-list", {
            coupons: couponsWithDetails,
            currentPage: page,
            totalPages: totalPages,
            totalCoupons: totalCoupons,
            limit: limit,
            search: search,
            status: status,
            sortBy: sortBy,
            sortOrder: req.query.sortOrder || "desc",
            stats: stats
        });

    } catch (error) {
        console.error("Error loading coupon list page:", error);
        res.redirect("/admin/pageerror");
    }
};

// Controller function to get coupon details for editing
const getEditCoupon = async (req, res) => {
    try {
        const couponId = req.query.id;

        if (!couponId) {
            return res.redirect("/admin/coupons");
        }

        const coupon = await Coupon.findById(couponId)
            .populate('applicableCategories', '_id name')
            .populate('applicableProducts', '_id productName');

        if (!coupon) {
            return res.redirect("/admin/coupons");
        }

        res.render("admin-edit-coupon", { coupon: coupon });

    } catch (error) {
        console.error("Error loading edit coupon page:", error);
        res.redirect("/admin/pageerror");
    }
};

// Controller function to handle coupon editing
const editCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const {
            name,
            offerPrice,
            minimumPrice,
            startDate,
            expireOn,
            discountType,
            applicableCategories,
            applicableProducts,
            isAllCategories,
            isAllProducts,
            maxUsesPerUser,
            totalUsageLimit,
            islist
        } = req.body;

        // Validate required fields
        if (!name || !offerPrice || !minimumPrice || !startDate || !expireOn || !discountType) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Check if coupon code already exists for other coupons (case-insensitive)
        const existingCoupon = await Coupon.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            _id: { $ne: couponId }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Coupon code already exists. Please use a different code."
            });
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const expirationDate = new Date(expireOn);
        const currentDate = new Date();

        if (startDateObj < currentDate.setHours(0, 0, 0, 0)) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be in the past"
            });
        }

        if (expirationDate <= startDateObj) {
            return res.status(400).json({
                success: false,
                message: "Expiration date must be after start date"
            });
        }

        // Validate discount type and amount
        if (!['flat', 'percentage'].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discount type"
            });
        }

        const offerPriceNum = parseFloat(offerPrice);
        if (offerPriceNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Discount amount must be greater than 0"
            });
        }

        if (discountType === 'percentage' && offerPriceNum > 100) {
            return res.status(400).json({
                success: false,
                message: "Percentage discount cannot exceed 100%"
            });
        }

        // Validate usage limits
        const maxUsesPerUserNum = parseInt(maxUsesPerUser) || 1;
        if (maxUsesPerUserNum < 1) {
            return res.status(400).json({
                success: false,
                message: "Maximum uses per user must be at least 1"
            });
        }

        const totalUsageLimitNum = totalUsageLimit ? parseInt(totalUsageLimit) : null;
        if (totalUsageLimitNum && totalUsageLimitNum < 1) {
            return res.status(400).json({
                success: false,
                message: "Total usage limit must be at least 1"
            });
        }

        // Get current coupon to check current usage
        const currentCoupon = await Coupon.findById(couponId);
        if (!currentCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        // Validate total usage limit against current usage
        if (totalUsageLimitNum && totalUsageLimitNum < (currentCoupon.currentUsageCount || 0)) {
            return res.status(400).json({
                success: false,
                message: `Total usage limit cannot be less than current usage (${currentCoupon.currentUsageCount || 0} users)`
            });
        }

        // Validate that maxUsesPerUser is not greater than totalUsageLimit
        if (totalUsageLimitNum && maxUsesPerUserNum > totalUsageLimitNum) {
            return res.status(400).json({
                success: false,
                message: "Maximum uses per user cannot be greater than total usage limit"
            });
        }

        if (parseFloat(minimumPrice) < 0) {
            return res.status(400).json({
                success: false,
                message: "Minimum order amount cannot be negative"
            });
        }

        // Validate category/product selection
        if (!isAllCategories && (!applicableCategories || applicableCategories.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one category or choose 'Apply to All Categories'"
            });
        }

        if (!isAllProducts && (!applicableProducts || applicableProducts.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Please select at least one product or choose 'Apply to All Products'"
            });
        }

        // Update coupon
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: name.toUpperCase().trim(),
                startDate: startDateObj,
                expireOn: expirationDate,
                discountType: discountType,
                offerPrice: offerPriceNum,
                minimumPrice: parseFloat(minimumPrice),
                applicableCategories: isAllCategories ? [] : (Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories]),
                applicableProducts: isAllProducts ? [] : (Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts]),
                isAllCategories: isAllCategories === 'true' || isAllCategories === true,
                isAllProducts: isAllProducts === 'true' || isAllProducts === true,
                maxUsesPerUser: maxUsesPerUserNum,
                totalUsageLimit: totalUsageLimitNum,
                islist: islist === 'true' || islist === true
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully!"
        });

    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update coupon. Please try again."
        });
    }
};

// Controller function to soft delete a coupon
const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;

        const result = await Coupon.findByIdAndUpdate(
            couponId,
            { islist: false },
            { new: true }
        );

        if (result) {
            res.json({
                success: true,
                message: "Coupon deactivated successfully"
            });
        } else {
            res.json({
                success: false,
                message: "Coupon not found"
            });
        }

    } catch (error) {
        console.error("Error deactivating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// Controller function to get all active categories for form population
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true })
            .select('_id name')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            categories: categories
        });

    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories"
        });
    }
};

// Controller function to get all active products for form population
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({
            isBlocked: false,
            status: 'Available'
        })
        .select('_id productName')
        .sort({ productName: 1 });

        res.status(200).json({
            success: true,
            products: products
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch products"
        });
    }
};

// Controller function to get detailed coupon usage analytics
const getCouponUsageDetails = async (req, res) => {
    try {
        const couponId = req.params.id;

        if (!couponId) {
            return res.status(400).json({
                success: false,
                message: "Coupon ID is required"
            });
        }

        // Get coupon details
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        // Get orders that used this coupon
        const Order = require("../../models/orderSchema");
        const User = require("../../models/userSchema");

        const ordersWithCoupon = await Order.find({
            couponCode: coupon.name,
            status: { $ne: 'Cancelled' } // Don't count cancelled orders
        })
        .populate('userId', 'name email')
        .select('userId orderId finalAmount couponDiscount createdOn status')
        .sort({ createdOn: -1 })
        .limit(50); // Limit to recent 50 orders for performance

        // Calculate usage statistics
        const totalUsageCount = coupon.currentUsageCount || 0;
        const totalDiscountGiven = ordersWithCoupon.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const averageOrderValue = ordersWithCoupon.length > 0 
            ? ordersWithCoupon.reduce((sum, order) => sum + order.finalAmount, 0) / ordersWithCoupon.length 
            : 0;

        // Get usage by month for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyUsage = await Order.aggregate([
            {
                $match: {
                    couponCode: coupon.name,
                    status: { $ne: 'Cancelled' },
                    createdOn: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdOn" },
                        month: { $month: "$createdOn" }
                    },
                    count: { $sum: 1 },
                    totalDiscount: { $sum: "$couponDiscount" }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                coupon: {
                    name: coupon.name,
                    discountType: coupon.discountType,
                    offerPrice: coupon.offerPrice,
                    minimumPrice: coupon.minimumPrice,
                    totalUsageLimit: coupon.totalUsageLimit,
                    maxUsesPerUser: coupon.maxUsesPerUser,
                    expireOn: coupon.expireOn,
                    islist: coupon.islist
                },
                statistics: {
                    totalUsageCount: totalUsageCount,
                    totalDiscountGiven: Math.round(totalDiscountGiven),
                    averageOrderValue: Math.round(averageOrderValue),
                    usagePercentage: coupon.totalUsageLimit 
                        ? Math.round((totalUsageCount / coupon.totalUsageLimit) * 100) 
                        : null
                },
                recentOrders: ordersWithCoupon.map(order => ({
                    orderId: order.orderId,
                    userName: order.userId ? order.userId.name : 'Unknown',
                    userEmail: order.userId ? order.userId.email : 'Unknown',
                    orderAmount: order.finalAmount,
                    discountAmount: order.couponDiscount || 0,
                    orderDate: order.createdOn,
                    status: order.status
                })),
                monthlyUsage: monthlyUsage
            }
        });

    } catch (error) {
        console.error("Error fetching coupon usage details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupon usage details"
        });
    }
};

module.exports = {
    getAddCouponPage,
    addCoupon,
    getCouponListPage,
    getEditCoupon,
    editCoupon,
    deleteCoupon,
    getCategories,
    getProducts,
    getCouponUsageDetails
};
