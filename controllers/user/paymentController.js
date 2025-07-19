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
       
        console.log('Creating Razorpay order for user:', userId);
        console.log('Request body:', { addressId, totalAmount });
        const roundedTotal = Math.round(totalAmount);

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        // Validate required fields
        if (!addressId || !roundedTotal || roundedTotal <= 0) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields or invalid amount"
            });
        }

        // Validate Razorpay credentials
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('Razorpay credentials not found in environment variables');
            return res.status(500).json({
                success: false,
                message: 'Payment service configuration error'
            });
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(parseFloat(roundedTotal) * 100), // Amount in paise, ensure it's an integer
            currency: 'INR',
            receipt: `ord_${Date.now().toString().slice(-10)}`, // Keep receipt under 40 chars
            notes: {
                userId: userId.toString(),
                addressId: addressId.toString()
            }
        };

        console.log('Razorpay order options:', options);

        const razorpayOrder = await razorpay.orders.create(options);
        
        console.log('Razorpay order created successfully:', razorpayOrder.id);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount:Math.round(razorpayOrder.amount),
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
            let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            let itemTotal = Math.round(itemPrice * item.quantity);
            
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

        // Check if this is a retry payment by looking for existing failed order
        let existingOrder = null;
        try {
            // Try to find a failed order with the same Razorpay order ID
            const razorpayOrderData = await razorpay.orders.fetch(razorpay_order_id);
            const failedOrderId = razorpayOrderData.notes?.failedOrderId;
            
            if (failedOrderId && failedOrderId !== 'cart_retry') {
                existingOrder = await Order.findOne({
                    orderId: failedOrderId,
                    userId: userId,
                    paymentStatus: 'Failed'
                });
            }
        } catch (fetchError) {
            console.log('Could not fetch Razorpay order details:', fetchError.message);
        }

        let orderId;
        
        if (existingOrder) {
            // Update existing failed order
            console.log('Updating existing failed order:', existingOrder.orderId);
            orderId = existingOrder.orderId;
            
            existingOrder.status = 'Processing';
            existingOrder.paymentStatus = 'Completed';
            existingOrder.razorpayOrderId = razorpay_order_id;
            existingOrder.razorpayPaymentId = razorpay_payment_id;
            existingOrder.razorpaySignature = razorpay_signature;
            
            await existingOrder.save();
        } else {
            // Generate unique order ID for new order
            orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

            // Create new order with coupon information
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
        }

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
        const userId = req.session.user;
        
        console.log('Payment failed:', error);
        console.log('Failed Razorpay order ID:', orderId);
        
        let failedOrderId = null;
        
        // Create a failed order record if user is logged in and we have cart data
        if (userId) {
            try {
                const userData = await User.findById(userId);
                const cart = await Cart.findOne({ userId }).populate({
                    path: 'items.productId',
                    populate: {
                        path: 'category',
                        model: 'Category'
                    }
                });

                if (cart && cart.items.length > 0) {
                    // Calculate order details similar to successful order creation
                    let validItems = [];
                    let subtotal = 0;

                    for (let item of cart.items) {
                        const product = item.productId;
                        
                        if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
                            continue;
                        }

                        const variant = product.variant.find(v => v.size === item.size);
                        if (!variant) {
                            continue;
                        }

                        // Apply best offer (product/category) to get item price
                        let productOffer = product.productOffer || 0;
                        let categoryOffer = (product.category && product.category.categoryOffer) || 0;
                        let bestOffer = Math.max(productOffer, categoryOffer);
                        let variantPrice = variant.varientPrice;
                        let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
                        let itemTotal = Math.round(itemPrice * item.quantity);
                        
                        validItems.push({
                            product: product._id,
                            quantity: item.quantity,
                            price: itemPrice,
                            size: variant.size
                        });

                        subtotal += itemTotal;
                    }

                    if (validItems.length > 0) {
                        // Calculate totals
                        const shippingCost = subtotal > 500 ? 0 : 50;
                        let totalAmount = subtotal + shippingCost;

                        // Handle coupon if applied
                        let couponData = {
                            applied: false,
                            code: null,
                            discount: 0,
                            originalAmount: totalAmount
                        };

                        const appliedCoupon = req.session.appliedCoupon;
                        if (appliedCoupon) {
                            const couponValidation = await validateCouponForCheckout(appliedCoupon, userId);
                            if (couponValidation.valid) {
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
                                    originalAmount: subtotal + shippingCost
                                };
                            }
                        }

                        // Generate unique order ID for failed order
                        failedOrderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

                        // Create failed order record
                        const failedOrder = new Order({
                            orderId: failedOrderId,
                            userId: userId,
                            orderedItems: validItems,
                            totalPrice: subtotal,
                            discount: couponData.discount,
                            finalAmount: totalAmount,
                            address: userId,
                            status: 'Pending',
                            paymentMethod: 'ONLINE',
                            paymentStatus: 'Failed',
                            razorpayOrderId: orderId,
                            couponApplied: couponData.applied,
                            couponCode: couponData.code,
                            couponDiscount: couponData.discount,
                            originalAmount: couponData.originalAmount,
                            createdOn: new Date()
                        });

                        await failedOrder.save();
                        console.log('Failed order record created:', failedOrderId);
                    }
                }
            } catch (orderError) {
                console.error('Error creating failed order record:', orderError);
                // Continue without failing the entire request
            }
        }
        
        const redirectUrl = failedOrderId 
            ? `/payment-failure?error=${encodeURIComponent(error.description || 'Payment failed')}&orderId=${failedOrderId}`
            : `/payment-failure?error=${encodeURIComponent(error.description || 'Payment failed')}`;
        
        res.json({
            success: false,
            message: 'Payment failed',
            redirectUrl: redirectUrl
        });

    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment failure'
        });
    }
};

// Retry payment for failed orders
const retryPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { failedOrderId } = req.body;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        let totalAmount;
        let addressId = null;

        // If we have a failed order ID, use that order's data
        if (failedOrderId) {
            const failedOrder = await Order.findOne({
                orderId: failedOrderId,
                userId: userId,
                paymentStatus: 'Failed'
            }).populate('orderedItems.product');

            if (failedOrder) {
                console.log('Found failed order for retry:', failedOrderId);
                totalAmount = failedOrder.finalAmount;
                
                // Validate that all items are still available
                for (let item of failedOrder.orderedItems) {
                    const product = await Product.findById(item.product);
                    if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
                        return res.status(400).json({ 
                            success: false, 
                            message: `Product ${product ? product.productName : 'Unknown'} is no longer available` 
                        });
                    }

                    const variant = product.variant.find(v => v.size === item.size);
                    if (!variant || variant.varientquantity < item.quantity) {
                        return res.status(400).json({ 
                            success: false, 
                            message: `Insufficient stock for ${product.productName} (Size: ${item.size})` 
                        });
                    }
                }
            } else {
                return res.status(404).json({ 
                    success: false, 
                    message: "Failed order not found" 
                });
            }
        } else {
            // Fallback to cart-based retry payment
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
                    message: "Cart is empty. Please add items to cart before retrying payment." 
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
                let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
                let itemTotal = Math.round(itemPrice * item.quantity);
                
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
            totalAmount = subtotal + shippingCost;

            // Handle coupon validation and application
            const appliedCoupon = req.session.appliedCoupon;
            if (appliedCoupon) {
                const couponValidation = await validateCouponForCheckout(appliedCoupon, userId);

                if (couponValidation.valid) {
                    const coupon = couponValidation.coupon;
                    let discountAmount;

                    if (coupon.discountType === 'percentage') {
                        discountAmount = Math.min((totalAmount * coupon.offerPrice) / 100, totalAmount);
                    } else {
                        discountAmount = Math.min(coupon.offerPrice, totalAmount);
                    }

                    totalAmount = totalAmount - discountAmount;
                } else {
                    // Remove invalid coupon from session
                    delete req.session.appliedCoupon;
                }
            }
        }

        const roundedTotal = Math.round(totalAmount);

        // Validate Razorpay credentials
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('Razorpay credentials not found in environment variables');
            return res.status(500).json({
                success: false,
                message: 'Payment service configuration error'
            });
        }

        // Create Razorpay order for retry
        const options = {
            amount: Math.round(parseFloat(roundedTotal) * 100), // Amount in paise
            currency: 'INR',
            receipt: `retry_${Date.now().toString().slice(-10)}`,
            notes: {
                userId: userId.toString(),
                retryPayment: 'true',
                failedOrderId: failedOrderId || 'cart_retry'
            }
        };

        console.log('Creating Razorpay order for retry payment:', options);

        const razorpayOrder = await razorpay.orders.create(options);
        
        console.log('Razorpay retry order created successfully:', razorpayOrder.id);

        // Get user's default address or first available address
        const addressData = await Address.findOne({ userId });
        const defaultAddress = addressData && addressData.adress && addressData.adress.length > 0 
            ? addressData.adress[0]._id 
            : null;

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: Math.round(razorpayOrder.amount),
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            addressId: defaultAddress
        });

    } catch (error) {
        console.error('Error creating retry payment order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create retry payment order. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    createRazorpayOrder,
    verifyPayment,
    handlePaymentFailure,
    retryPayment
};