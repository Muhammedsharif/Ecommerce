const User = require("../models/userSchema");

const addWishlistCount = async (req, res, next) => {
    try {
        // Initialize wishlist count
        res.locals.wishlistCount = 0;
        
        // If user is logged in, get their wishlist count
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            if (user && user.wishlist) {
                res.locals.wishlistCount = user.wishlist.length;
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
