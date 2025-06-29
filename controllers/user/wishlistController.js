const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")



const loadWishlist = async(req,res)=>{
    try {

        const userId = req.session.user
        const user = await User.findById(userId)
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }

        const products = await Product.findById(productId);
        if (!products) {
            return res.status(404).json({ status: false, message: 'Product not found' });
        }

        // Check if product is already in wishlist
        const productIndex = user.wishlist.indexOf(productId);

        if (productIndex > -1) {
            // Product exists, remove it
            user.wishlist.splice(productIndex, 1);
            await user.save();
            return res.status(200).json({
                status: true,
                action: 'removed',
                message: 'Product removed from wishlist'
            });
        } else {
            // Product doesn't exist, add it
            user.wishlist.push(productId);
            await user.save();
            return res.status(200).json({
                status: true,
                action: 'added',
                message: 'Product added to wishlist'
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
        const user = await User.findById(userId)
        const index = user.wishlist.indexOf(productId)
        user.wishlist.splice(index,1)
        await user.save()
        return res.redirect("/wishlist")
        
    } catch (error) {

        console.error(error)
        return res.status(500).json({status:false,message:"Server error"})

        
    }
}




module.exports={
    loadWishlist,
    addToWishlist,
    removeProduct,
}