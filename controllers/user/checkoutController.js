// Checkout controller for handling order placement and payment processing
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const { validateCouponForCheckout, markCouponAsUsed } = require("./couponController");

// Controller function to load and display the checkout page
const loadCheckout = async (req, res) => {
    try {
        // Get user ID from session
        const userId = req.session.user;

        // Redirect to login if user is not authenticated
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        // Get cart items for the user with populated product and category data
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'category',
                model: 'Category'
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart");
        }

        let cartItems = cart.items;
        let subtotal = 0;
        let validItems = [];

        // Validate cart items and calculate totals
        for (let item of cartItems) {
            const product = item.productId;
            
            // Check if product exists and is not blocked/deleted
            if (!product || product.isBlocked || product.isDeleted) {
                continue; // Skip invalid products
            }

            // Check if product is available
            if (product.status !== "Available") {
                continue; // Skip unavailable products
            }

            // Find the specific variant for this cart item
            const variant = product.variant.find(v => v.size === item.size);
            if (!variant || variant.varientquantity < item.quantity) {
                continue; // Skip items with insufficient stock
            }

            // Calculate item total using variant pricing
            let itemPrice =  variant.varientPrice;
            let itemTotal = itemPrice * item.quantity;
            
            validItems.push({
                ...item.toObject(),
                productId: product,
                itemPrice: itemPrice,
                itemTotal: itemTotal
            });

            subtotal += itemTotal;
        }

        // If no valid items, redirect to cart
        if (validItems.length === 0) {
            return res.redirect("/cart");
        }

        // Get user addresses
        const addressData = await Address.findOne({ userId });
        const addresses = addressData ? addressData.adress : [];

        // Calculate shipping and taxes
        const shippingCost = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
        const taxRate = 0.18; // 18% GST
        const taxAmount = Math.round(subtotal * taxRate);

        // Get applied coupon from session
        const appliedCoupon = req.session.appliedCoupon || null;
        let couponDiscount = 0;
        let finalAmount = subtotal + shippingCost + taxAmount;

        // Apply coupon discount if available
        if (appliedCoupon) {
            // Validate coupon and recalculate discount for display
            const { validateCouponForCheckout } = require('./couponController');
            const couponValidation = await validateCouponForCheckout(appliedCoupon, userId);

            if (couponValidation.valid) {
                const coupon = couponValidation.coupon;
                const totalBeforeDiscount = subtotal + shippingCost + taxAmount;

                if (coupon.discountType === 'percentage') {
                    couponDiscount = Math.min((totalBeforeDiscount * coupon.offerPrice) / 100, totalBeforeDiscount);
                } else {
                    couponDiscount = Math.min(coupon.offerPrice, totalBeforeDiscount);
                }

                finalAmount = totalBeforeDiscount - couponDiscount;
            } else {
                // Remove invalid coupon from session
                delete req.session.appliedCoupon;
                couponDiscount = 0;
            }
        }

        res.render("checkout", {
            user: userData,
            cartItems: validItems,
            addresses: addresses,
            subtotal: subtotal,
            shippingCost: shippingCost,
            taxAmount: taxAmount,
            totalAmount: finalAmount,
            appliedCoupon: appliedCoupon,
            couponDiscount: couponDiscount,
            originalAmount: subtotal + shippingCost + taxAmount
        });

    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.redirect("/pageNotFound");
    }
};

// Controller function to process checkout and create order
const processCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        // Validate required fields
        if (!addressId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Please select delivery address and payment method"
            });
        }

        // Validate payment method
        const validPaymentMethods = ['COD', 'ONLINE', 'WALLET'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method selected"
            });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Get cart items
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        let validItems = [];
        let subtotal = 0;

        // Re-validate cart items and stock
        for (let item of cart.items) {
            const product = item.productId;
            
            if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
                continue;
            }

            const variant = product.variant.find(v => v.size === item.size);
            if (!variant || variant.varientquantity < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.productName} (Size: ${item.size})` 
                });
            }

            let itemPrice =  variant.varientPrice;
            let itemTotal = itemPrice * item.quantity;
            let itemsize = variant.size
            
            validItems.push({
                product: product._id,
                quantity: item.quantity,
                price: itemPrice,
                size:itemsize
            });

            subtotal += itemTotal;
        }

        if (validItems.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "No valid items in cart" 
            });
        }

        // Calculate totals
        const shippingCost = subtotal > 500 ? 0 : 50;
        const taxAmount = Math.round(subtotal * 0.18);
        let totalAmount = subtotal + shippingCost + taxAmount;

        // Handle coupon validation and application
        let couponData = {
            applied: false,
            code: null,
            discount: 0,
            originalAmount: totalAmount
        };

        const appliedCoupon = req.session.appliedCoupon;
        if (appliedCoupon) {
            // Validate coupon before processing order
            const couponValidation = await validateCouponForCheckout(appliedCoupon, userId);

            if (couponValidation.valid) {
                // Recalculate discount based on current cart total and discount type
                const coupon = couponValidation.coupon;
                let discountAmount;

                if (coupon.discountType === 'percentage') {
                    discountAmount = Math.min((totalAmount * coupon.offerPrice) / 100, totalAmount);
                } else {
                    discountAmount = Math.min(coupon.offerPrice, totalAmount);
                }

                totalAmount = totalAmount - discountAmount;

                couponData = {
                    applied: true,
                    code: appliedCoupon.couponCode,
                    discount: discountAmount,
                    originalAmount: subtotal + shippingCost + taxAmount,
                    couponId: appliedCoupon.couponId
                };
            } else {
                // Remove invalid coupon from session
                delete req.session.appliedCoupon;
                return res.status(400).json({
                    success: false,
                    message: couponValidation.message || "Coupon is no longer valid"
                });
            }
        }

        // Validate wallet payment if selected
        if (paymentMethod === 'WALLET') {
            const userWalletBalance = userData.wallet || 0;
            if (userWalletBalance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. Available: ₹${userWalletBalance.toLocaleString('en-IN')}, Required: ₹${totalAmount.toLocaleString('en-IN')}`
                });
            }
        }

        // Generate unique order ID
        const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

        // Create order with coupon information
        const newOrder = new Order({
            orderId: orderId,
            userId: userId,
            orderedItems: validItems,
            totalPrice: subtotal,
            discount: couponData.discount,
            finalAmount: totalAmount,
            address: userId, // Using userId as per schema design
            status: paymentMethod === 'COD' ? 'Pending' : paymentMethod === 'WALLET' ? 'Processing' : 'Processing',
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : paymentMethod === 'WALLET' ? 'Completed' : 'Pending',
            couponApplied: couponData.applied,
            couponCode: couponData.code,
            couponDiscount: couponData.discount,
            originalAmount: couponData.originalAmount,
            createdOn: new Date()
        });

        await newOrder.save();

        // Mark coupon as used if applied
        if (couponData.applied && couponData.couponId) {
            await markCouponAsUsed(couponData.couponId, userId);
            // Clear coupon from session
            delete req.session.appliedCoupon;
        }

        // Process wallet payment if selected
        if (paymentMethod === 'WALLET') {
            // Deduct amount from user wallet
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: -totalAmount }
            });

            // Create wallet transaction record
            const WalletTransaction = require("../../models/walletTransactionSchema");
            await WalletTransaction.create({
                userId: userId,
                type: 'debit',
                amount: totalAmount,
                description: `Payment for order ${orderId}`,
                orderId: orderId,
                source: 'order_payment',
                balanceAfter: (userData.wallet || 0) - totalAmount,
                status: 'completed'
            });
        }

        // Update product stock
        for (let item of cart.items) {
            const product = await Product.findById(item.productId);
            if (product) {
                const variantIndex = product.variant.findIndex(v => v.size === item.size);
                if (variantIndex !== -1) {
                    product.variant[variantIndex].varientquantity -= item.quantity;
                    await product.save();
                }
            }
        }

        // Clear cart
        await Cart.findOneAndDelete({ userId });

        res.status(200).json({ 
            success: true, 
            message: "Order placed successfully!",
            orderId: orderId,
            redirectUrl: `/order-confirmation/${orderId}`
        });

    } catch (error) {
        console.error("Error processing checkout:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to process order. Please try again." 
        });
    }
};

// Controller function to load thank you page with order details
const loadThankYou = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect("/login");
        }

        // Find the order by orderId and userId for security
        const order = await Order.findOne({
            orderId: orderId,
            userId: userId
        }).populate({
            path: 'orderedItems.product',
            select: 'productName productImage'
        });

        if (!order) {
            return res.redirect("/pageNotFound");
        }

        // Get user data
        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/login");
        }

        res.render("thank-you", {
            user: userData,
            order: order
        });

    } catch (error) {
        console.error("Error loading thank you page:", error);
        res.redirect("/pageNotFound");
    }
};

// Load payment success page
const loadPaymentSuccess = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect('/login');
        }

        // Find the order
        const order = await Order.findOne({
            orderId: orderId,
            userId: userId
        }).populate('orderedItems.product');

        if (!order) {
            return res.redirect('/profile');
        }

        res.render('payment-success', {
            user: req.session.user,
            order: order
        });

    } catch (error) {
        console.error('Error loading payment success page:', error);
        res.redirect('/profile');
    }
};

// Load payment failure page
const loadPaymentFailure = async (req, res) => {
    try {
        const error = req.query.error || 'Payment failed. Please try again.';
        console.log('Payment failed:', error);
        res.render('payment-failure', {
            user: req.session.user || null,
            error: error
        });

    } catch (error) {
        console.error('Error loading payment failure page:', error);
        res.redirect('/checkout');
    }
};

module.exports = {
    loadCheckout,
    processCheckout,
    loadThankYou,
    loadPaymentSuccess,
    loadPaymentFailure
};
