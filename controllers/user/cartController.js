const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")

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

        res.render("cart", {
            user: userData
        });

    } catch (error) {
        console.error("Error loading cart:", error);
        res.redirect("/pageNotFound");
    }
}


module.exports = {
    loadCart,
}