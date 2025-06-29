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

        res.render("changePassword", {
            user: userData,
            page: 'password'
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

// Email Change Functionality
const sendEmailOTP = async (req, res) => {
    try {
        const { newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in first' });
        }

        if (!newEmail) {
            return res.status(400).json({ success: false, message: 'New email is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        // Generate OTP
        const otp = Math.floor(10000 + Math.random() * 90000).toString();

        // Store OTP in session with expiration
        req.session.emailChangeOTP = {
            otp: otp,
            newEmail: newEmail,
            expires: Date.now() + 10 * 60 * 1000 // 10 minutes
        };

        // Send OTP email
        const nodemailer = require('nodemailer');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: newEmail,
            subject: 'Email Change Verification - 1NOTONE',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Email Change Verification</h2>
                    <p>You have requested to change your email address on 1NOTONE.</p>
                    <p>Your verification code is:</p>
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #667eea; margin: 0; font-size: 2em;">${otp}</h1>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this change, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log("changeEmail:",otp)
        res.json({ success: true, message: 'OTP sent successfully' });

    } catch (error) {
        console.error('Error sending email OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
}

const loadVerifyEmailOTP = async (req, res) => {
    try {
        const { email } = req.query;
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        if (!email) {
            return res.redirect("/change-password?error=Invalid email");
        }

        res.render("verifyEmailOtp", {
            newEmail: email
        });
    } catch (error) {
        console.error("Error loading verify email OTP page:", error);
        res.redirect("/pageNotFound");
    }
}

const verifyEmailOTP = async (req, res) => {
    try {
        const { otp, newEmail } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        // Check if OTP session exists
        if (!req.session.emailChangeOTP) {
            return res.render("verifyEmailOtp", {
                newEmail: newEmail,
                error: "OTP session expired. Please request a new OTP."
            });
        }

        const { otp: sessionOTP, newEmail: sessionEmail, expires } = req.session.emailChangeOTP;

        // Check if OTP expired
        if (Date.now() > expires) {
            delete req.session.emailChangeOTP;
            return res.render("verifyEmailOtp", {
                newEmail: newEmail,
                error: "OTP has expired. Please request a new OTP."
            });
        }

        // Check if email matches
        if (sessionEmail !== newEmail) {
            return res.render("verifyEmailOtp", {
                newEmail: newEmail,
                error: "Invalid email. Please try again."
            });
        }

        // Verify OTP
        if (otp !== sessionOTP) {
            return res.render("verifyEmailOtp", {
                newEmail: newEmail,
                error: "Invalid OTP. Please check and try again."
            });
        }

        // Update user email
        await User.findByIdAndUpdate(userId, { email: newEmail });

        // Clear OTP session
        delete req.session.emailChangeOTP;

        // Redirect to success page
        res.redirect("/change-password?success=Email changed successfully!");

    } catch (error) {
        console.error("Error verifying email OTP:", error);
        res.render("verifyEmailOtp", {
            newEmail: req.body.newEmail,
            error: "An error occurred. Please try again."
        });
    }
}

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/pageNotFound");
        }

        // Validate passwords
        if (newPassword !== confirmPassword) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "New password and confirm password do not match"
            });
        }

        if (newPassword.length < 6) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Password must be at least 6 characters long"
            });
        }

        // Verify current password
        const bcrypt = require('bcrypt');
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Current password is incorrect"
            });
        }

        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

        res.render("changePassword", {
            user: user,
            page: 'password',
            success: "Password changed successfully!"
        });

    } catch (error) {
        console.error("Error changing password:", error);
        const user = await User.findById(req.session.user);
        res.render("changePassword", {
            user: user,
            page: 'password',
            error: "An error occurred while changing password"
        });
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
    loadReferral,
    sendEmailOTP,
    loadVerifyEmailOTP,
    verifyEmailOTP,
    changePassword
}