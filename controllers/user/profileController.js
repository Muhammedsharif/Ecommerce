const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")


const userProfile = async (req,res) =>{
    try {

             const userId = req.session.user;
             console.log(userId)
        if (!userId) {
            return res.redirect("/login"); // session illa
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound"); // user illa
        }
         res.render("profile", {
            user: userData,
        });
        
    } catch (error) {

        console.error("Error for profile data",error)
        res.redirect("/pageNotFound")
        
    }
}

module.exports={
    userProfile,
}