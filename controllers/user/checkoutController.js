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

        // Check if this is a direct buy now checkout
        const buyNowData = req.session.buyNowData;
        let cartItems = [];
        let subtotal = 0;
        let validItems = [];

        if (buyNowData) {
            // Handle Buy Now checkout
            const product = await Product.findById(buyNowData.productId).populate('category');
            
            if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
                delete req.session.buyNowData;
                return res.redirect("/pageNotFound");
            }

            // Find the specific variant
            const variant = product.variant.find(v => v.size === buyNowData.size);
            if (!variant || variant.varientquantity < buyNowData.quantity) {
                delete req.session.buyNowData;
                return res.redirect(`/productDetails?id=${buyNowData.productId}`);
            }

            // Calculate item total using best offer (product/category)
            let variantPrice = variant.varientPrice;
            let productOffer = product.productOffer || 0;
            let categoryOffer = (product.category && product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            let itemTotal = Math.round(itemPrice * buyNowData.quantity);
            
            validItems.push({
                productId: product,
                quantity: buyNowData.quantity,
                size: buyNowData.size,
                color: buyNowData.color,
                itemPrice: itemPrice,
                itemTotal: itemTotal
            });

            subtotal = itemTotal;
        } else {
            // Handle regular cart checkout
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

            cartItems = cart.items;

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

                // Calculate item total using best offer (product/category)
                let variantPrice = variant.varientPrice;
                let productOffer = product.productOffer || 0;
                let categoryOffer = (product.category && product.category.categoryOffer) || 0;
                let bestOffer = Math.max(productOffer, categoryOffer);
                let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
                let itemTotal = Math.round(itemPrice * item.quantity);
                
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
        }

        // Get user addresses
        const addressData = await Address.findOne({ userId });
        const addresses = addressData ? addressData.adress : [];

        // Calculate shipping (no tax)
        const shippingCost = subtotal > 500 ? 0 : 50; // Free shipping above ₹500

        // Get applied coupon from session
        const appliedCoupon = req.session.appliedCoupon || null;
        let couponDiscount = 0;
        let finalAmount = subtotal + shippingCost;

        // Apply coupon discount if available
        if (appliedCoupon) {
            // Validate coupon and recalculate discount for display
            const { validateCouponForCheckout } = require('./couponController');
            const couponValidation = await validateCouponForCheckout(appliedCoupon, userId, req);

            if (couponValidation.valid) {
                const coupon = couponValidation.coupon;
                const totalBeforeDiscount = subtotal + shippingCost;

                if (coupon.discountType === 'percentage') {
                    // For percentage discounts, divide equally among all products
                    couponDiscount = Math.min((totalBeforeDiscount * coupon.offerPrice) / 100, totalBeforeDiscount);
                } else {
                    // For flat discounts, use current logic
                    couponDiscount = Math.min(coupon.offerPrice, totalBeforeDiscount);
                }

                finalAmount = totalBeforeDiscount - couponDiscount;
            } else {
                // Remove invalid coupon from session
                delete req.session.appliedCoupon;
                couponDiscount = 0;
            }
        }

        // Check if COD should be disabled (orders above ₹4000)
        const isCODDisabled = finalAmount > 4000;

        res.render("checkout", {
            user: userData,
            cartItems: validItems,
            addresses: addresses,
            subtotal: subtotal,
            shippingCost: shippingCost,
            totalAmount: finalAmount,
            appliedCoupon: appliedCoupon,
            couponDiscount: couponDiscount,
            originalAmount: subtotal + shippingCost,
            isBuyNow: !!buyNowData,
            isCODDisabled: isCODDisabled
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

        let validItems = [];
        let subtotal = 0;
        let itemsToUpdateStock = [];

        // Check if this is a Buy Now checkout
        const buyNowData = req.session.buyNowData;

        if (buyNowData) {
            // Handle Buy Now checkout
            const product = await Product.findById(buyNowData.productId).populate('category');
            
            if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
                delete req.session.buyNowData;
                return res.status(400).json({ 
                    success: false, 
                    message: "Product is no longer available" 
                });
            }

            const variant = product.variant.find(v => v.size === buyNowData.size);
            if (!variant || variant.varientquantity < buyNowData.quantity) {
                delete req.session.buyNowData;
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.productName} (Size: ${buyNowData.size})` 
                });
            }

            // Calculate item price using best offer (product/category)
            let variantPrice = variant.varientPrice;
            let productOffer = product.productOffer || 0;
            let categoryOffer = (product.category && product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            let itemTotal = Math.round(itemPrice * buyNowData.quantity);

            validItems.push({
                product: product._id,
                quantity: buyNowData.quantity,
                price: itemPrice, // legacy
                finalPrice: itemPrice, // explicit final price for clarity
                size: buyNowData.size
            });

            itemsToUpdateStock.push({
                productId: product._id,
                size: buyNowData.size,
                quantity: buyNowData.quantity
            });

            subtotal = itemTotal;
        } else {
            // Handle regular cart checkout
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

                // Calculate item price using best offer (product/category)
                let variantPrice = variant.varientPrice;
                let productOffer = product.productOffer || 0;
                let categoryOffer = (product.category && product.category.categoryOffer) || 0;
                let bestOffer = Math.max(productOffer, categoryOffer);
                let itemPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
                let itemTotal = Math.round(itemPrice * item.quantity);
                let itemsize = variant.size;

                validItems.push({
                    product: product._id,
                    quantity: item.quantity,
                    price: itemPrice, // legacy
                    finalPrice: itemPrice, // explicit final price for clarity
                    size: itemsize
                });

                itemsToUpdateStock.push({
                    productId: product._id,
                    size: item.size,
                    quantity: item.quantity
                });

                subtotal += itemTotal;
            }

            if (validItems.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "No valid items in cart" 
                });
            }
        }

        // Calculate totals using correct subtotal (no tax)
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
            const couponValidation = await validateCouponForCheckout(appliedCoupon, userId, req);

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
                return res.status(400).json({
                    success: false,
                    message: couponValidation.message || "Coupon is no longer valid"
                });
            }
        }

        // Validate COD restriction for orders above ₹4000
        if (paymentMethod === 'COD' && totalAmount > 4000) {
            return res.status(400).json({
                success: false,
                message: "COD is available only for orders up to ₹4000. Please choose online payment or wallet payment."
            });
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
        for (let item of itemsToUpdateStock) {
            const product = await Product.findById(item.productId);
            if (product) {
                const variantIndex = product.variant.findIndex(v => v.size === item.size);
                if (variantIndex !== -1) {
                    product.variant[variantIndex].varientquantity -= item.quantity;
                    await product.save();
                }
            }
        }

        // Clear cart only if it's not a Buy Now order
        if (!buyNowData) {
            await Cart.findOneAndDelete({ userId });
        } else {
            // Clear Buy Now data from session
            delete req.session.buyNowData;
        }

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
            populate: { path: 'category', model: 'Category' }
        });

        if (!order) {
            return res.redirect("/pageNotFound");
        }

        // For each ordered item, attach the correct display price using the best offer
        order.orderedItems.forEach(item => {
            let variant = null;
            if (item.product && item.product.variant && item.size) {
                variant = item.product.variant.find(v => String(v.size) === String(item.size));
            }
            let productOffer = item.product.productOffer || 0;
            let categoryOffer = (item.product.category && item.product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let variantPrice = variant && typeof variant.varientPrice === 'number' ? variant.varientPrice : (typeof item.price === 'number' ? item.price : 0);
            let displayPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            item.displayPrice = displayPrice;
        });

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
        }).populate({
            path: 'orderedItems.product',
            populate: { path: 'category', model: 'Category' }
        });

        if (!order) {
            return res.redirect('/profile');
        }

        // Attach offer-adjusted displayPrice to each ordered item
        order.orderedItems.forEach(item => {
            let variant = null;
            if (item.product && item.product.variant && item.size) {
                variant = item.product.variant.find(v => String(v.size) === String(item.size));
            }
            let productOffer = item.product.productOffer || 0;
            let categoryOffer = (item.product.category && item.product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let variantPrice = variant && typeof variant.varientPrice === 'number' ? variant.varientPrice : (typeof item.price === 'number' ? item.price : 0);
            let displayPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            item.displayPrice = displayPrice;
        });

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
        const failedOrderId = req.query.orderId || null;
        console.log('Payment failed:', error);
        console.log('Failed order ID:', failedOrderId);
        
        res.render('payment-failure', {
            user: req.session.user || null,
            error: error,
            failedOrderId: failedOrderId
        });

    } catch (error) {
        console.error('Error loading payment failure page:', error);
        res.redirect('/checkout');
    }
};

// Load retry payment page
const loadRetryPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect('/login');
        }

        // Find the failed order
        const order = await Order.findOne({
            orderId: orderId,
            userId: userId,
            paymentStatus: 'Failed'
        }).populate({
            path: 'orderedItems.product',
            populate: { path: 'category', model: 'Category' }
        });

        if (!order) {
            return res.redirect('/orders');
        }

        // Calculate coupon discount per item if coupon was applied
        let couponDiscountPerItem = 0;
        if (order.couponApplied && order.couponDiscount > 0) {
            // Calculate total number of products in the order (considering quantities)
            const totalProductCount = order.orderedItems.reduce((sum, item) => {
                return sum + item.quantity;
            }, 0);
            
            // Distribute coupon discount equally among all products
            couponDiscountPerItem = order.couponDiscount / totalProductCount;
        }

        // Calculate the correct display price for each item including coupon discount
        order.orderedItems.forEach(item => {
            // Start with the stored item price (which includes product/category offers)
            let basePrice = item.price;
            
            // Verify the base price calculation for consistency
            if (item.product && item.product.variant && item.size) {
                const variant = item.product.variant.find(v => v.size === item.size);
                if (variant) {
                    const productOffer = item.product.productOffer || 0;
                    const categoryOffer = (item.product.category && item.product.category.categoryOffer) || 0;
                    const bestOffer = Math.max(productOffer, categoryOffer);
                    const variantPrice = variant.varientPrice;
                    const calculatedPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
                    
                    // Use calculated price if there's a significant difference
                    if (Math.abs(basePrice - calculatedPrice) > 1) {
                        basePrice = calculatedPrice;
                    }
                }
            }
            
            // Apply coupon discount per item to get the final display price
            const finalItemPrice = Math.round(basePrice - couponDiscountPerItem);
            item.displayPrice = Math.max(0, finalItemPrice); // Ensure price doesn't go negative
            
            console.log(`Item: ${item.product.productName}`);
            console.log(`Base price (with offers): ${basePrice}`);
            console.log(`Coupon discount per item: ${couponDiscountPerItem}`);
            console.log(`Final display price: ${item.displayPrice}`);
            console.log(`---`);
        });

        // Get user data
        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect('/login');
        }

        res.render('retry-payment', {
            user: userData,
            order: order
        });

    } catch (error) {
        console.error('Error loading retry payment page:', error);
        res.redirect('/orders');
    }
};

// Controller function to handle Buy Now functionality
const buyNow = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue",
                redirectUrl: "/login"
            });
        }

        const { productId, size, quantity, color } = req.body;

        // Validate required fields
        if (!productId || !size || !quantity) {
            return res.status(400).json({
                success: false,
                message: "Missing required product information"
            });
        }

        // Validate quantity
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid quantity"
            });
        }

        // Validate product and stock
        const product = await Product.findById(productId).populate('category');
        if (!product || product.isBlocked || product.isDeleted || product.status !== "Available") {
            return res.status(400).json({
                success: false,
                message: "Product is not available"
            });
        }

        // Find the specific variant
        const variant = product.variant.find(v => v.size === size);
        if (!variant) {
            return res.status(400).json({
                success: false,
                message: "Selected size is not available"
            });
        }

        if (variant.varientquantity < qty) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant.varientquantity} items available in stock`
            });
        }

        // Store Buy Now data in session
        req.session.buyNowData = {
            productId: productId,
            size: size,
            quantity: qty,
            color: color || product.color
        };

        res.status(200).json({
            success: true,
            message: "Redirecting to checkout",
            redirectUrl: "/checkout"
        });

    } catch (error) {
        console.error("Error in Buy Now:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
};

module.exports = {
    loadCheckout,
    processCheckout,
    loadThankYou,
    loadPaymentSuccess,
    loadPaymentFailure,
    loadRetryPayment,
    buyNow
};
