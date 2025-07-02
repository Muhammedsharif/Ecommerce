const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")

const getOrderPage = async (req,res)=>{
    try {

        res.render("orders")
        
    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

module.exports = {
    getOrderPage,
}