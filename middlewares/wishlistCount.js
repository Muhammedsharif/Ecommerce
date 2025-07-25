const User = require("../models/userSchema");

const addWishlistCount = async (req, res, next) => {
    try {
        // Initialize wishlist count
        res.locals.wishlistCount = 0;
        
        // If user is logged in, get their wishlist count
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user) {
                // Ensure wishlist is an array and get its length
                if (Array.isArray(user.wishlist)) {
                    res.locals.wishlistCount = user.wishlist.length;
                } else {
                    // If wishlist is not an array, initialize it as empty array
                    user.wishlist = [];
                    await user.save();
                    res.locals.wishlistCount = 0;
                }
                console.log(`User ${user._id} wishlist count: ${res.locals.wishlistCount}`); // Debug log
            }
        }
        
        next();
    } catch (error) {
        console.error('Error in wishlistCount middleware:', error);
        // Don't break the request, just set count to 0
        res.locals.wishlistCount = 0;
        next();
    }
};

module.exports = addWishlistCount;