const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")



function generateOtp() {
    const digits = "1234567890"
    let otp = ""
    for(let i=0; i<4;i++){
        otp +=digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const sendVerificationEmail = async (email, otp) => {
    try {

        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const mailOptions = {
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for Password Reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP: ${otp}</h4></b>`
        }

        const info = await transporter.sendMail(mailOptions)
        console.log("Email sent:", info.messageId)
        return true
        
    } catch (error) {

        console.error("Error sending email:", error)
        return false
        
    }
}

const securePassword = async (password) => {
    try {

        const passswordHash = await bcrypt.hash(password,10)
        return passswordHash
        
    } catch (error) {
        
    }
}


const loadForgotPassword = async (req,res) => {
    try {

        res.render("forgot-password")
        
    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

const forgotEmailValid = async (req,res) => {
    try {

        const {email} = req.body
        const findUser = await User.findOne({email:email})
        
        if(findUser){
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email,otp)
            if(emailSent){
                req.session.userOtp = otp
                req.session.email  = email
                res.render("forgotPass-otp")
                console.log("OTP sent",otp)
            }else{
                res.json({success:false, message:"Email not found"})
            }
        }else{
            res.render("forgot-password",{
                message:"User with this email does not exist"
            })
        }

    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

const verifyForgotPassOtp = async (req,res) =>{
    try {

        const enteredOtp = req.body.otp
        if(enteredOtp===req.session.userOtp){
            res.json({success:true, redirectUrl:"/reset-Password"})
        }else{
            res.json({success:false,message:"Invalid OTP, Please try again"})
        }
        
    } catch (error) {

        res.status(500).json({success:false,message:"An error occured. Please try again"})
        
    }
}

const loadResetPassword = async (req,res) => {
    try {

        res.render("reset-password")
        
    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

const resendOtp = async (req,res) => {
    try {

        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        console.log("resending OTP to email",email)
        const emailSent = await sendVerificationEmail(email,otp)

        if(emailSent){
            console.log("OTP sent again",otp)
            res.status(200).json({success:true, message:"Resend OTP successfull"})
        }
        
    } catch (error) {

        console.error("Error resending OTP",error)
        res.status(500).json({success:false, message:"An error occured. Please try again"})
        
    }
}

const resetPassword = async (req,res) => {
    try {
        
        const {newPass1,newPass2} = req.body
        console.log(newPass1,newPass2)
        const email = req.session.email
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1)
            await User.updateOne({email:email},{$set:{password:passwordHash}})
            res.redirect("/login")
        }else{
            
            res.render("reset-password",{message:"Passwords do not match"})
        }
        
    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

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
            page: 'profile'
        });

    } catch (error) {

        console.error("Error for profile data",error)
        res.redirect("/pageNotFound")

    }
}

// Placeholder controllers for additional profile pages
const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        // For now, render a simple page or redirect to profile with a message
        res.render("profile", {
            user: userData,
            page: 'address',
            message: 'Address management coming soon!'
        });
    } catch (error) {
        console.error("Error loading address page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("profile", {
            user: userData,
            page: 'orders',
            message: 'Order history coming soon!'
        });
    } catch (error) {
        console.error("Error loading orders page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("profile", {
            user: userData,
            page: 'wallet',
            message: 'Wallet management coming soon!'
        });
    } catch (error) {
        console.error("Error loading wallet page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadChangePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("profile", {
            user: userData,
            page: 'password',
            message: 'Change password functionality coming soon!'
        });
    } catch (error) {
        console.error("Error loading change password page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadReferral = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("profile", {
            user: userData,
            page: 'referral',
            message: 'Referral program coming soon!'
        });
    } catch (error) {
        console.error("Error loading referral page:", error);
        res.redirect("/pageNotFound");
    }
}



module.exports={
    userProfile,
    loadForgotPassword,
    forgotEmailValid,
    verifyForgotPassOtp,
    loadResetPassword,
    resendOtp,
    resetPassword,
    loadAddress,
    loadOrders,
    loadWallet,
    loadChangePassword,
    loadReferral
}