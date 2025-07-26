// Wishlist management controller for user wishlist functionality
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")


// Controller function to load and display user's wishlist page
const loadWishlist = async(req,res)=>{
    try {
        // Get user ID from session and fetch user data
        const userId = req.session.user
        const user = await User.findById(userId)
        // Fetch all products in user's wishlist with category information
        const products = await Product.find({_id:{$in:user.wishlist}}).populate('category')
        res.render("wishlist",{
            user,
            wishlist:products,
            products: products,
            page: "wishlist",
        })

        
    } catch (error) {

        console.error(error)
        res.redirect("/pageNotFound")
        
    }
}

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ status: false, message: 'Please log in to add to wishlist' });
        }

        // Verify product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ status: false, message: 'Product not found' });
        }

        // Check if product is already in wishlist using atomic operation
        const userWithProduct = await User.findOne({
            _id: userId,
            wishlist: productId
        });

        if (userWithProduct) {
            // Product exists, remove it using atomic operation
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $pull: { wishlist: productId } },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ status: false, message: 'User not found' });
            }

            return res.status(200).json({
                status: true,
                action: 'removed',
                message: 'Product removed from wishlist',
                wishlistCount: updatedUser.wishlist.length
            });
        } else {
            // Product doesn't exist, add it using atomic operation
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $addToSet: { wishlist: productId } },
                { new: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ status: false, message: 'User not found' });
            }

            return res.status(200).json({
                status: true,
                action: 'added',
                message: 'Product added to wishlist',
                wishlistCount: updatedUser.wishlist.length
            });
        }
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        return res.status(500).json({ status: false, message: 'Server error' });
    }
};


const removeProduct = async (req,res)=>{
    try {
        const productId = req.query.productId
        const userId = req.session.user

        if (!userId) {
            return res.redirect("/login")
        }

        // Use atomic operation to remove product from wishlist
        await User.findByIdAndUpdate(
            userId,
            { $pull: { wishlist: productId } }
        )

        return res.redirect("/wishlist")
        
    } catch (error) {
        console.error(error)
        return res.status(500).json({status:false,message:"Server error"})
    }
}

// Get wishlist count for header badge
const getWishlistCount = async(req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.json({ success: true, wishlistCount: 0 });
        }

        const user = await User.findById(userId);
        
        if (!user) {
            return res.json({ success: true, wishlistCount: 0 });
        }

        // Ensure wishlist is an array
        let wishlistCount = 0;
        if (Array.isArray(user.wishlist)) {
            wishlistCount = user.wishlist.length;
        } else {
            // If wishlist is not an array, fix it
            user.wishlist = [];
            await user.save();
            wishlistCount = 0;
        }

        console.log(`API: User ${userId} wishlist count: ${wishlistCount}`); // Debug log
        res.json({ success: true, wishlistCount: wishlistCount });

    } catch (error) {
        console.error("Error getting wishlist count:", error);
        res.json({ success: false, wishlistCount: 0 });
    }
}

const emptyWishlist = async (req,res)=>{
    try {
        const userId = req.session.user;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        await User.findByIdAndUpdate(userId, { $set: { wishlist: [] } });

        res.json({ success: true, message: "Wishlist emptied successfully" });
    } catch (error) {
        console.error("Error emptying wishlist:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
}




module.exports={
    loadWishlist,
    addToWishlist,
    removeProduct,
    getWishlistCount,
    emptyWishlist,
    
}