const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")



const loadProductDetails = async (req,res)=>{
    try {

        
        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId).populate("category")
        const findCategory = product.category
        const categoryOffer = findCategory ?.categoryOffer || 0
        const productOffer = product.productOffer || 0
        const totalOffer = categoryOffer + productOffer

         const similarProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id }  // exclude the current product
    }).limit(4);

   const availableSizes = [...new Set(product.variant.map(v => v.size))];

        res.render("productDetails",{
            user:userData,
            product:product,
            quantity:product.quantity,
            color:product.color,
            similarProducts:similarProducts,
            totalOffer:totalOffer,
            category:findCategory,
            sizes: availableSizes
        })


       

        
    } catch (error) {
        console.error("Error for feching product details",error)
        res.redirect("/pageNotFound")
        
    }
}

module.exports ={
    loadProductDetails,
} 