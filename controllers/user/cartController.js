const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Cart = require("../../models/cartSchema")

const loadCart = async (req,res) =>{
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        // Get cart items for the user
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        const cartItems = cart ? cart.items : [];

        res.render("cart", {
            user: userData,
            cartItems: cartItems,
            cart: cart
        });

    } catch (error) {
        console.error("Error loading cart:", error);
        res.redirect("/pageNotFound");
    }
}

const addToCart = async(req,res)=>{
    try {
        console.log('=== ADD TO CART REQUEST RECEIVED ===');
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Request body:', req.body);
        console.log('Session:', req.session);

        const userId = req.session.user;
        const { productId, size, color } = req.body;

        console.log('Add to cart request:', { userId, productId, size, color, body: req.body, session: req.session });

        if (!userId) {
            console.log('No user session found - returning 401');
            return res.status(401).json({ success: false, message: 'Please login to add items to cart', redirectTo: '/login' });
        }

        if (!productId) {
            console.log('No product ID provided');
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Check if product exists and is available
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.isBlocked || product.status !== 'Available') {
            return res.status(400).json({ success: false, message: 'Product is not available' });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Product is out of stock' });
        }

        // Find or create cart
        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Check if product with same size and color already exists in cart
            const existingItemIndex = cart.items.findIndex(item =>
                item.productId.toString() === productId &&
                item.size === (size || 'N/A') &&
                item.color === (color || 'N/A')
            );

            if (existingItemIndex > -1) {
                // Product exists, increment quantity
                const currentQuantity = cart.items[existingItemIndex].quantity;

                // Check if adding one more would exceed the 10-item limit per product
                if (currentQuantity >= 10) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot add more than 10 items of the same product to cart.'
                    });
                }

                if (currentQuantity >= product.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot add more items. Stock limit reached.'
                    });
                }

                cart.items[existingItemIndex].quantity += 1;
                cart.items[existingItemIndex].totalPrice =
                    cart.items[existingItemIndex].quantity * product.salePrice;
                // Ensure size and color are preserved/updated
                cart.items[existingItemIndex].size = size || cart.items[existingItemIndex].size || 'N/A';
                cart.items[existingItemIndex].color = color || cart.items[existingItemIndex].color || 'N/A';
                    
            } else {
                // Add new product to cart
                cart.items.push({
                    productId: productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    size: size || 'N/A',
                    color: color || 'N/A'
                });
            }
        } else {
            // Create new cart
            cart = new Cart({
                userId: userId,
                items: [{
                    productId: productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    size: size || 'N/A',
                    color: color || 'N/A'
                }]
            });
        }

        await cart.save();

        // Get updated cart count
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

        res.json({
            success: true,
            message: 'Product added to cart successfully',
            cartCount: cartCount,
            productName: product.productName
        });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: 'Failed to add to cart' });
    }
}

// Get cart count for header badge
const getCartCount = async(req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.json({ success: true, cartCount: 0 });
        }

        const cart = await Cart.findOne({ userId });
        const cartCount = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;

        res.json({ success: true, cartCount: cartCount });

    } catch (error) {
        console.error("Error getting cart count:", error);
        res.json({ success: false, cartCount: 0 });
    }
}

const moveToCartFromWishlist = async(req, res) => {
    try {
        const userId = req.session.user;
        const { productId, size, color } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to move items to cart' });
        }

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Check if product exists and is available
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.isBlocked || product.status !== 'Available') {
            return res.status(400).json({ success: false, message: 'Product is not available' });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Product is out of stock' });
        }

        // Remove from wishlist
        const user = await User.findById(userId);
        if (!user.wishlist.includes(productId)) {
            return res.status(400).json({ success: false, message: 'Product not in wishlist' });
        }

        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        await user.save();

        // Find or create cart
        let cart = await Cart.findOne({ userId });

        if (cart) {
            // Check if product with same size and color already exists in cart
            const existingItemIndex = cart.items.findIndex(item =>
                item.productId.toString() === productId &&
                item.size === (size || 'N/A') &&
                item.color === (color || 'N/A')
            );

            if (existingItemIndex > -1) {
                // Product exists, increment quantity
                const currentQuantity = cart.items[existingItemIndex].quantity;

                if (currentQuantity >= product.quantity) {
                    // Add back to wishlist since we can't add to cart
                    user.wishlist.push(productId);
                    await user.save();
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot add more items. Stock limit reached.'
                    });
                }

                cart.items[existingItemIndex].quantity += 1;
                cart.items[existingItemIndex].totalPrice =
                    cart.items[existingItemIndex].quantity * product.salePrice;
            } else {
                // Add new product to cart
                cart.items.push({
                    productId: productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    size: size || 'N/A',
                    color: color || 'N/A'
                });
            }
        } else {
            // Create new cart
            cart = new Cart({
                userId: userId,
                items: [{
                    productId: productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    size: size || 'N/A',
                    color: color || 'N/A'
                }]
            });
        }

        await cart.save();

        // Get updated cart count
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

        res.json({
            success: true,
            message: `${product.productName} moved from wishlist to cart`,
            cartCount: cartCount,
            productName: product.productName
        });

    } catch (error) {
        console.error("Error moving to cart from wishlist:", error);
        res.status(500).json({ success: false, message: 'Failed to move item to cart' });
    }
}

// Update cart item quantity
const updateCartQuantity = async(req, res) => {
    try {
        const userId = req.session.user;
        const { itemId, quantity } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in' });
        }

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        if (quantity > 10) {
            return res.status(400).json({ success: false, message: 'Cannot add more than 10 items of the same product' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        // Update quantity
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;

        await cart.save();

        res.json({ success: true, message: 'Cart updated successfully' });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
}

// Remove item from cart
const removeFromCart = async(req, res) => {
    try {
        const userId = req.session.user;
        const { itemId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Remove item from cart
        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        await cart.save();

        res.json({ success: true, message: 'Item removed from cart' });

    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ success: false, message: 'Failed to remove item' });
    }
}

// Empty entire cart
const emptyCart = async(req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Empty the cart
        cart.items = [];
        await cart.save();

        res.json({ success: true, message: 'Cart emptied successfully' });

    } catch (error) {
        console.error("Error emptying cart:", error);
        res.status(500).json({ success: false, message: 'Failed to empty cart' });
    }
}

module.exports = {
    loadCart,
    addToCart,
    getCartCount,
    updateCartQuantity,
    removeFromCart,
    moveToCartFromWishlist,
    emptyCart
}