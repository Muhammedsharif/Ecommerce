const razorpay = require('../../config/razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const { validateCouponForCheckout, markCouponAsUsed } = require('./couponController');

// Create Razorpay order
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, totalAmount } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        // Validate required fields
        if (!addressId || !totalAmount) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Create Razorpay order
        const options = {
            amount: totalAmount * 100, // Amount in paise
            currency: 'INR',
            receipt: `order_${Date.now()}`,
            notes: {
                userId: userId,
                addressId: addressId
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID || 'rzp_test_your_key_id'
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};

// Verify Razorpay payment and create order
const verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            addressId 
        } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

        // Get user and cart data
        const userData = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'category',
                model: 'Category'
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Validate cart items and calculate totals
        let validItems = [];
        let subtotal = 0;

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

            // Apply best offer (product/category) to get item price
            let productOffer = product.productOffer || 0;
            let categoryOffer = (product.category && product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let variantPrice = variant.varientPrice;
            let itemPrice = bestOffer > 0 ? variantPrice - (variantPrice * bestOffer / 100) : variantPrice;
            let itemTotal = itemPrice * item.quantity;
            
            validItems.push({
                product: product._id,
                quantity: item.quantity,
                price: itemPrice,
                size: variant.size
            });

            subtotal += itemTotal;
        }

        if (validItems.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "No valid items in cart" 
            });
        }

        // Calculate totals (no tax)
        const shippingCost = subtotal > 500 ? 0 : 50;
        let totalAmount = subtotal + shippingCost;

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
                    originalAmount: subtotal + shippingCost,
                    couponId: appliedCoupon.couponId
                };
            } else {
                // Remove invalid coupon from session
                delete req.session.appliedCoupon;
                console.log('Coupon validation failed during online payment:', couponValidation.message);
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
            address: userId,
            status: 'Processing',
            paymentMethod: 'ONLINE',
            paymentStatus: 'Completed',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
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

        res.json({
            success: true,
            message: 'Payment verified and order created successfully',
            orderId: orderId,
            redirectUrl: `/payment-success/${orderId}`
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};

// Handle payment failure
const handlePaymentFailure = async (req, res) => {
    try {
        const { error, orderId } = req.body;
        
        console.log('Payment failed:', error);
        
        res.json({
            success: false,
            message: 'Payment failed',
            redirectUrl: `/payment-failure?error=${encodeURIComponent(error.description || 'Payment failed')}`
        });

    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment failure'
        });
    }
};

module.exports = {
    createRazorpayOrder,
    verifyPayment,
    handlePaymentFailure
};
