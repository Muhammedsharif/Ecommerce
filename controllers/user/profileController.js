const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Product = require("../../models/productSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")
const { calculateEqualCouponDiscount, calculateSingleItemCouponDiscount } = require("../../helpers/couponHelper")



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
        const addressData = await Address.findOne({userId:userId})
        if (!userData) {
            return res.redirect("/pageNotFound"); // user illa
        }
         res.render("profile", {
            user: userData,
            page: 'profile',
            address: addressData
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

        // Get user's addresses
        const addressData = await Address.findOne({ userId: userId });
        const addresses = addressData ? addressData.adress : [];

        // Check for success message from URL parameters
        const successMessage = req.query.success;

        res.render("address", {
            user: userData,
            page: 'address',
            addresses: addresses,
            success: successMessage
        });
    } catch (error) {
        console.error("Error loading address page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("addressAdd", {
            user: userData,
            page: 'address'
        });
    } catch (error) {
        console.error("Error loading add address page:", error);
        res.redirect("/pageNotFound");
    }
}

// Address validation helper function
const validateAddressData = (addressData) => {
    const errors = [];

    // Name validation
    if (!addressData.name || addressData.name.trim().length === 0) {
        errors.push("Name is required");
    } else if (addressData.name.trim().length < 3) {
        errors.push("Name must be at least 3 characters long");
    } else if (addressData.name.trim().length > 50) {
        errors.push("Name must not exceed 50 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(addressData.name.trim())) {
        errors.push("Name can only contain letters and spaces");
    }

    // Address Type validation
    if (!addressData.addressType || addressData.addressType.trim().length === 0) {
        errors.push("Address type is required");
    } else {
        const validTypes = ['Home', 'Work', 'Other'];
        if (!validTypes.includes(addressData.addressType)) {
            errors.push("Address type must be Home, Work, or Other");
        }
    }

    // City validation
    if (!addressData.city || addressData.city.trim().length === 0) {
        errors.push("City is required");
    } else if (addressData.city.trim().length < 2) {
        errors.push("City must be at least 2 characters long");
    } else if (addressData.city.trim().length > 30) {
        errors.push("City must not exceed 30 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(addressData.city.trim())) {
        errors.push("City can only contain letters and spaces");
    }

    // Landmark validation
    if (!addressData.landmark || addressData.landmark.trim().length === 0) {
        errors.push("Landmark is required");
    } else if (addressData.landmark.trim().length < 3) {
        errors.push("Landmark must be at least 3 characters long");
    } else if (addressData.landmark.trim().length > 100) {
        errors.push("Landmark must not exceed 100 characters");
    }

    // State validation
    if (!addressData.state || addressData.state.trim().length === 0) {
        errors.push("State is required");
    } else if (addressData.state.trim().length < 2) {
        errors.push("State must be at least 2 characters long");
    } else if (addressData.state.trim().length > 30) {
        errors.push("State must not exceed 30 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(addressData.state.trim())) {
        errors.push("State can only contain letters and spaces");
    }

    // Pincode validation
    if (!addressData.pincode) {
        errors.push("Pincode is required");
    } else {
        const pincodeStr = addressData.pincode.toString();
        if (!/^\d{6}$/.test(pincodeStr)) {
            errors.push("Pincode must be exactly 6 digits");
        }
    }

    // Phone validation
    if (!addressData.phone || addressData.phone.trim().length === 0) {
        errors.push("Phone number is required");
    } else {
        const phoneStr = addressData.phone.trim();
        if (!/^\d{10}$/.test(phoneStr)) {
            errors.push("Phone number must be exactly 10 digits");
        }
    }

   

    return errors;
}

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        // Extract and sanitize address data
        const addressData = {
            name: req.body.name ? req.body.name.trim() : '',
            addressType: req.body.addressType ? req.body.addressType.trim() : '',
            city: req.body.city ? req.body.city.trim() : '',
            landmark: req.body.landmark ? req.body.landmark.trim() : '',
            state: req.body.state ? req.body.state.trim() : '',
            pincode: req.body.pincode,
            phone: req.body.phone ? req.body.phone.trim() : '',
            altPhone: req.body.altPhone ? req.body.altPhone.trim() : '',
            isDefault: req.body.isDefault === 'on' || req.body.isDefault === 'true' || req.body.isDefault === true
        };

        // Validate address data
        const validationErrors = validateAddressData(addressData);

        if (validationErrors.length > 0) {
            // Map errors to specific fields
            const fieldErrors = {};
            validationErrors.forEach(error => {
                if (error.includes('Name')) {
                    fieldErrors.name = error;
                } else if (error.includes('Phone')) {
                    fieldErrors.phone = error;
                } else if (error.includes('City')) {
                    fieldErrors.city = error;
                } else if (error.includes('State')) {
                    fieldErrors.state = error;
                } else if (error.includes('Pincode')) {
                    fieldErrors.pincode = error;
                } else if (error.includes('Landmark')) {
                    fieldErrors.landmark = error;
                } else if (error.includes('Address type')) {
                    fieldErrors.addressType = error;
                }
            });

            return res.render("addressAdd", {
                user: userData,
                page: 'address',
                errors: validationErrors,
                fieldErrors: fieldErrors,
                formData: addressData
            });
        }

        // Check if user already has addresses
        let userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            // First address - automatically make it default
            addressData.isDefault = true;

            // Create new address document
            userAddress = new Address({
                userId: userId,
                adress: [addressData]
            });
        } else {
            // Check if user already has 5 addresses (limit)
            if (userAddress.adress.length >= 5) {
                return res.render("addressAdd", {
                    user: userData,
                    page: 'address',
                    errors: ["You can only have maximum 5 addresses"],
                    fieldErrors: {},
                    formData: addressData
                });
            }

            // Handle default address logic
            if (addressData.isDefault) {
                // Set all existing addresses to non-default
                userAddress.adress.forEach(address => {
                    address.isDefault = false;
                });
            } else {
                // If no address is currently default and this is not being set as default,
                // check if user has any default address
                const hasDefaultAddress = userAddress.adress.some(address => address.isDefault);
                if (!hasDefaultAddress) {
                    // Make this address default if no other default exists
                    addressData.isDefault = true;
                }
            }

            // Add new address to existing addresses
            userAddress.adress.push(addressData);
        }

        // Save the address
        await userAddress.save();

        // Redirect to address page with success parameter
        res.redirect("/address?added=true");

    } catch (error) {
        console.error("Error adding address:", error);

        const userData = await User.findById(req.session.user);
        res.render("addressAdd", {
            user: userData,
            page: 'address',
            errors: ["An error occurred while adding the address. Please try again."],
            fieldErrors: {},
            formData: req.body
        });
    }
}

const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Address ID is required" });
        }

        // Find user's address document
        const userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            return res.status(404).json({ success: false, message: "No addresses found for user" });
        }

        // Find the specific address to set as default
        const targetAddress = userAddress.adress.id(addressId);

        if (!targetAddress) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        // Set all addresses to non-default
        userAddress.adress.forEach(address => {
            address.isDefault = false;
        });

        // Set the target address as default
        targetAddress.isDefault = true;

        // Save the changes
        await userAddress.save();

        res.json({
            success: true,
            message: "Default address updated successfully",
            defaultAddressId: addressId
        });

    } catch (error) {
        console.error("Error setting default address:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while setting default address"
        });
    }
}

const loadeditAddress = async (req,res)=>{
    try {

        const addressId = req.query.id
        const user = req.session.user
        const currAddress = await Address.findOne({
            
            "adress._id":addressId
        })

        if(!currAddress){
            console.log("currAddress")
            return res.redirect("/pageNotFound")
            

        }

        const addressData = currAddress.adress.find((item)=>{
            return item._id.toString()===addressId.toString();
        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }

        res.render("editAddress",{address:addressData,user:user})
        
    } catch (error) {

        console.error("Error in edit address",error)
        res.redirect("/pageNotFound")        
    }
}

const editAddress = async (req,res)=>{
    try {

        const data = req.body
        console.log("req.body",data)
        const addressId = req.query.id
        const user = req.session.user
        const findAddress = await Address.findOne({"adress._id":addressId})
        if(!findAddress){
            res.redirect("/pageNotFound")
        }

        await Address.updateOne(
            {"adress._id":addressId},
            {$set:{
                "adress.$":{
                    _id:addressId,
                    name:data.name,
                    addressType:data.addressType,
                    city:data.city,
                    landmark:data.landmark,
                    state:data.state,
                    pincode:data.pincode,
                    phone:data.phone,
                    isDefault:data.isDefault
                }
            }}
        )

        res.redirect('/address?updated=true')
        
    } catch (error) {

        console.error("Error in edit address",error)
        res.redirect("/pageNotFound")        
    }
}

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.query.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Address ID is required" });
        }

        // Find user's address document
        const userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            return res.status(404).json({ success: false, message: "No addresses found for user" });
        }

        // Find the specific address to delete
        const targetAddress = userAddress.adress.id(addressId);

        if (!targetAddress) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        // Check if this is the only address
        if (userAddress.adress.length === 1) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete the only address. You must have at least one address."
            });
        }

        // Check if deleting the default address
        const wasDefault = targetAddress.isDefault;

        // Remove the address
        await Address.updateOne(
            { "adress._id": addressId },
            { $pull: { adress: { _id: addressId } } }
        );

        // If we deleted the default address, set another address as default
        if (wasDefault) {
            const updatedUserAddress = await Address.findOne({ userId: userId });
            if (updatedUserAddress && updatedUserAddress.adress.length > 0) {
                // Set the first remaining address as default
                updatedUserAddress.adress[0].isDefault = true;
                await updatedUserAddress.save();
            }
        }

        res.json({
            success: true,
            message: "Address deleted successfully"
        });

    } catch (error) {
        console.error("Error in delete address:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while deleting the address"
        });
    }
}

const loadOrders = async (req, res) => {
    try {
        let search = req.query.search || "";
        const page = parseInt(req.query.page)|| 1;
        const limit = 4;

        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        // Get user's orders with populated product details
        const orders = await Order.find({ userId: userId })
            .limit(limit)
            .skip((page-1)*limit)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage salePrice price offerPrice discount isOfferActive'
            })
            .sort({ createdOn: -1 });

        // Set displayPrice for each ordered item in each order
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                let basePrice = (item.price && typeof item.price === 'number') ? item.price : (item.product && item.product.price ? item.product.price : 0);
                let productOffer = (item.product && item.product.productOffer) ? item.product.productOffer : 0;
                let categoryOffer = (item.product && item.product.category && item.product.category.categoryOffer) ? item.product.category.categoryOffer : 0;
                let bestOffer = Math.max(productOffer, categoryOffer);
                let displayPrice;
                if (bestOffer > 0) {
                    displayPrice = Math.round(basePrice - (basePrice * bestOffer / 100));
                } else if (item.product && item.product.salePrice) {
                    displayPrice = Math.round(item.product.salePrice);
                } else if (item.product && item.product.price) {
                    displayPrice = Math.round(item.product.price);
                } else {
                    displayPrice = Math.round(item.price);
                }
                item.displayPrice = displayPrice;
            });
        });

        const count = await Order.countDocuments({userId:userId});
        const totalPages = Math.ceil(count / limit);

        res.render("orders", {
            user: userData,
            orders: orders,
            success: req.query.success,
            totalPages:totalPages,
            currentPage:page,
            search,
            error: req.query.error
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

        // Import WalletTransaction model
        const WalletTransaction = require("../../models/walletTransactionSchema");

        // Get recent wallet transactions (last 10)
        const transactions = await WalletTransaction.find({ userId: userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Calculate wallet statistics
        const walletStats = await WalletTransaction.aggregate([
            { $match: { userId: userData._id } },
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        // Process statistics
        let totalAdded = 0;
        let totalSpent = 0;

        walletStats.forEach(stat => {
            if (stat._id === 'credit') {
                totalAdded = stat.totalAmount;
            } else if (stat._id === 'debit') {
                totalSpent = stat.totalAmount;
            }
        });

        res.render("wallet", {
            user: userData,
            page: 'wallet',
            transactions: transactions,
            walletStats: {
                currentBalance: userData.wallet || 0,
                totalAdded: totalAdded,
                totalSpent: totalSpent
            }
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
            page: 'referral'
        });
    } catch (error) {
        console.error("Error loading referral page:", error);
        res.redirect("/pageNotFound");
    }
}

const loadCoupons = async (req, res) => {
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
            page: 'coupons'
        });
    } catch (error) {
        console.error("Error loading coupons page:", error);
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

        // Check if this is a profile update with pending changes
        if (req.session.pendingProfileUpdate) {
            const pendingUpdate = req.session.pendingProfileUpdate;

            // Update all profile fields including email
            await User.findByIdAndUpdate(userId, {
                name: pendingUpdate.name,
                phone: pendingUpdate.phone,
                email: newEmail,
                profileImage: pendingUpdate.profileImage
            });

            // Clear pending update from session
            delete req.session.pendingProfileUpdate;
            delete req.session.emailChangeOTP;

            res.redirect("/Profile?success=" + encodeURIComponent("Profile updated successfully"));
        } else {
            // Regular email change from password page
            await User.findByIdAndUpdate(userId, { email: newEmail });

            // Clear OTP session
            delete req.session.emailChangeOTP;

            // Redirect to success page
            res.redirect("/change-password?success=Email changed successfully!");
        }

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

        // Validate that current password is provided
        if (!currentPassword || currentPassword.trim() === '') {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Current password is required"
            });
        }

        // Validate that new password is provided
        if (!newPassword || newPassword.trim() === '') {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "New password is required"
            });
        }

        // Validate that confirm password is provided
        if (!confirmPassword || confirmPassword.trim() === '') {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Confirm password is required"
            });
        }

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "New password and confirm password do not match"
            });
        }

        // Validate password length
        if (newPassword.length < 8) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Password must be at least 8 characters long"
            });
        }

        // Verify current password - this is the critical security check
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Current password is incorrect"
            });
        }

        // Check if new password is different from current password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);

        if (isSamePassword) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "New password must be different from your current password"
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



// Load Edit Profile Page
const loadEditProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        res.render("editProfile", {
            user: userData,
            errors: null,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error("Error loading edit profile page:", error);
        res.redirect("/pageNotFound");
    }
}

// Update Profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name, phone } = req.body;
        const errors = {};

        // Validation
        if (!name || name.trim().length < 2) {
            errors.name = "Name must be at least 2 characters long";
        }

        if (phone && phone.trim() !== '') {
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                errors.phone = "Phone number must be 10 digits";
            }
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect("/pageNotFound");
        }

        if (Object.keys(errors).length > 0) {
            return res.render("editProfile", {
                user: user,
                errors: errors,
                success: null,
                error: null
            });
        }

        // Handle profile image upload
        let profileImageName = user.profileImage;
        if (req.file) {
            profileImageName = req.file.filename;
        }

        // Update profile
        const updateData = {
            name: name.trim(),
            profileImage: profileImageName
        };

        // Only update phone if it's provided and not empty
        if (phone && phone.trim() !== '') {
            updateData.phone = phone.trim();
        }

        await User.findByIdAndUpdate(userId, updateData);

        res.redirect("/Profile?success=" + encodeURIComponent("Profile updated successfully"));

    } catch (error) {
        console.error("Error updating profile:", error);
        const user = await User.findById(req.session.user);
        res.render("editProfile", {
            user: user,
            errors: null,
            success: null,
            error: "An error occurred while updating profile"
        });
    }
}

// Load Order Details
const loadOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/pageNotFound");
        }

        const order = await Order.findOne({ _id: orderId, userId: userId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage salePrice price offerPrice discount isOfferActive'
            });

        if (!order) {
            return res.redirect("/orders?error=" + encodeURIComponent("Order not found"));
        }

        // Set displayPrice for each ordered item based on offer/discount
        order.orderedItems.forEach(item => {
            let displayPrice = item.product && item.product.salePrice;
            // If you have a more complex offer logic, implement it here
            if (item.product && item.product.isOfferActive && item.product.offerPrice) {
                displayPrice = item.product.offerPrice;
            } else if (item.product && item.product.discount && item.product.discount > 0) {
                displayPrice = Math.round(item.product.price - (item.product.price * item.product.discount / 100));
            } else if (item.product && item.product.salePrice) {
                displayPrice = item.product.salePrice;
            } else if (item.product && item.product.price) {
                displayPrice = item.product.price;
            }
            item.displayPrice = Math.round(displayPrice);
        });

        // Calculate display totals for order views (handles partial returns/cancellations)
        const { getOrderDisplayTotals } = require("../../helpers/couponHelper");
        const displayTotals = getOrderDisplayTotals(order);
        
        // Add display totals to order object for view rendering
        order.displaySubtotal = displayTotals.subtotal;
        order.displayCouponDiscount = displayTotals.couponDiscount;
        order.displayFinalAmount = displayTotals.finalAmount;
        
        res.render("orderDetails", {
            user: userData,
            order: order,
            success: req.query.success,
            error: req.query.error
        });

    } catch (error) {
        console.error("Error loading order details:", error);
        res.redirect("/orders?error=" + encodeURIComponent("Failed to load order details"));
    }
}

// Cancel Order
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, cancellationReason } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Try to find order by _id first, then by orderId if not found
        let order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');
        if (!order) {
            order = await Order.findOne({ orderId: orderId, userId: userId }).populate('orderedItems.product');
        }
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if order can be cancelled
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: "This order cannot be cancelled"
            });
        }

        // Increment stock for cancelled products
        for (let item of order.orderedItems) {
            const product = await Product.findById(item.product._id);
            if (product) {
                const variantIndex = product.variant.findIndex(v => v.size === item.size);
                if (variantIndex !== -1) {
                    product.variant[variantIndex].varientquantity += item.quantity;
                    await product.save();
                }
            }
        }

        // Handle immediate refund for ONLINE and WALLET payments (no admin approval needed for cancellations)
        let refundAmount = 0;
        if (["ONLINE", "WALLET"].includes(order.paymentMethod)) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            
            refundAmount = order.finalAmount;
            if (refundAmount > 0) {
                const currentWalletBalance = user.wallet || 0;
                const newWalletBalance = currentWalletBalance + refundAmount;
                await User.findByIdAndUpdate(userId, { wallet: newWalletBalance });
                
                const WalletTransaction = require("../../models/walletTransactionSchema");
                const transactionMetadata = {
                    orderAmount: order.finalAmount,
                    cancellationInitiatedBy: 'user',
                    cancellationAt: new Date(),
                    originalPaymentMethod: order.paymentMethod,
                    couponApplied: order.couponApplied || false,
                    autoRefund: true, // Mark as automatic refund for cancellation
                    adminApprovalRequired: false
                };
                
                // Add payment method specific metadata
                if (order.paymentMethod === 'ONLINE') {
                    transactionMetadata.razorpayPayment = true;
                    transactionMetadata.razorpayOrderId = order.razorpayOrderId || null;
                    transactionMetadata.razorpayPaymentId = order.razorpayPaymentId || null;
                }
                
                if (order.couponApplied && order.couponCode) {
                    transactionMetadata.couponCode = order.couponCode;
                    transactionMetadata.couponDiscount = order.couponDiscount || 0;
                }
                
                let description = `Automatic refund for cancelled order ${order.orderId || orderId}`;
                if (order.paymentMethod === 'ONLINE') {
                    description += ` - Online payment refund`;
                } else if (order.paymentMethod === 'WALLET') {
                    description += ` - Wallet payment refund`;
                }
                
                await WalletTransaction.create({
                    userId: userId,
                    type: 'credit',
                    amount: refundAmount,
                    description: description,
                    orderId: order.orderId || orderId,
                    source: 'return_refund',
                    balanceAfter: newWalletBalance,
                    status: 'completed',
                    metadata: transactionMetadata
                });
            }
        }

        // Update order status to cancelled with optional reason
        order.status = 'Cancelled';
        order.paymentStatus = 'Refunded'; // Update payment status for refunded orders
        if (cancellationReason) order.cancellationReason = cancellationReason;
        await order.save();

        let message = "Order cancelled successfully";
        if (refundAmount > 0) {
            message += `. ₹${refundAmount.toLocaleString('en-IN')} has been automatically credited to your wallet.`;
        }
        res.json({ success: true, message: message });
        
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Failed to cancel order" });
    }
}

// Return Order
const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, returnReason } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Validate that return reason is provided (mandatory)
        if (!returnReason || returnReason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Return reason is required"
            });
        }

        const order = await Order.findOne({ _id: orderId, userId: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if order can be returned
        if (order.status !== 'Delivered') {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned"
            });
        }

        // Update order status to return request with mandatory reason
        await Order.findByIdAndUpdate(orderId, {
            status: 'Return Request',
            returnReason: returnReason.trim()
        });

        res.json({ success: true, message: "Return request submitted successfully" });

    } catch (error) {
        console.error("Error processing return request:", error);
        res.status(500).json({ success: false, message: "Failed to process return request" });
    }
}

// Cancel Individual Item
const cancelItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, itemId, cancellationReason } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Validate that cancellation reason is provided (mandatory)
        if (!cancellationReason || cancellationReason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Cancellation reason is required"
            });
        }

        const order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Find the specific item to cancel
        const itemIndex = order.orderedItems.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }

        const item = order.orderedItems[itemIndex];

        // Check if item can be cancelled
        if (item.status === 'Cancelled' || item.status === 'Return Request' || item.status === 'Returned') {
            return res.status(400).json({
                success: false,
                message: "This item cannot be cancelled"
            });
        }

        if (item.status === 'Delivered' || order.status === 'Delivered') {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel delivered items. Please use return option instead."
            });
        }

        // Increment stock for cancelled product
        const product = await Product.findById(item.product._id);
        if (product) {
            const variantIndex = product.variant.findIndex(v => v.size === item.size);
            if (variantIndex !== -1) {
                product.variant[variantIndex].varientquantity += item.quantity;
                await product.save();
            }
        }

        // Handle immediate refund for ONLINE and WALLET payments (no admin approval needed for cancellations)
        let refundAmount = 0;
        if (["ONLINE", "WALLET"].includes(order.paymentMethod)) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            
            // Calculate refund amount for this specific item with proper coupon discount handling
            if (order.couponApplied && order.couponDiscount > 0) {
                const couponCalculation = calculateSingleItemCouponDiscount(order, item);
                refundAmount = couponCalculation.adjustedRefundAmount;
            } else {
                refundAmount = (item.price || 0) * (item.quantity || 1);
            }
            
            if (refundAmount > 0) {
                const currentWalletBalance = user.wallet || 0;
                const newWalletBalance = currentWalletBalance + refundAmount;
                await User.findByIdAndUpdate(userId, { wallet: newWalletBalance });
                
                const WalletTransaction = require("../../models/walletTransactionSchema");
                const transactionMetadata = {
                    orderAmount: order.finalAmount,
                    itemRefund: true,
                    itemPrice: item.price,
                    itemQuantity: item.quantity,
                    cancellationInitiatedBy: 'user',
                    cancellationAt: new Date(),
                    originalPaymentMethod: order.paymentMethod,
                    couponApplied: order.couponApplied || false,
                    autoRefund: true, // Mark as automatic refund for cancellation
                    adminApprovalRequired: false
                };
                
                // Add payment method specific metadata
                if (order.paymentMethod === 'ONLINE') {
                    transactionMetadata.razorpayPayment = true;
                    transactionMetadata.razorpayOrderId = order.razorpayOrderId || null;
                    transactionMetadata.razorpayPaymentId = order.razorpayPaymentId || null;
                }
                
                if (order.couponApplied && order.couponCode) {
                    transactionMetadata.couponCode = order.couponCode;
                    transactionMetadata.couponDiscount = order.couponDiscount || 0;
                }
                
                let description = `Automatic refund for cancelled item in order ${order.orderId || orderId}`;
                if (order.paymentMethod === 'ONLINE') {
                    description += ` - Online payment refund`;
                } else if (order.paymentMethod === 'WALLET') {
                    description += ` - Wallet payment refund`;
                }
                
                await WalletTransaction.create({
                    userId: userId,
                    type: 'credit',
                    amount: refundAmount,
                    description: description,
                    orderId: order.orderId || orderId,
                    source: 'return_refund',
                    balanceAfter: newWalletBalance,
                    status: 'completed',
                    metadata: transactionMetadata
                });
            }
        }

        // Update item status and add cancellation reason
        order.orderedItems[itemIndex].status = 'Cancelled';
        order.orderedItems[itemIndex].cancellationReason = cancellationReason.trim();

        // Check if all items are cancelled to update order status
        const allItemsCancelled = order.orderedItems.every(item =>
            item.status === 'Cancelled' || item.status === 'Returned'
        );

        if (allItemsCancelled) {
            order.status = 'Cancelled';
            order.paymentStatus = 'Refunded';
        }

        await order.save();

        let message = "Item cancelled successfully. Stock has been restored.";
        if (refundAmount > 0) {
            message += ` ₹${refundAmount.toLocaleString('en-IN')} has been automatically credited to your wallet.`;
        }

        res.json({ success: true, message: message });

    } catch (error) {
        console.error("Error cancelling item:", error);
        res.status(500).json({ success: false, message: "Failed to cancel item" });
    }
}

// Cancel All Items
const cancelAllItems = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, cancellationReason } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Validate that cancellation reason is provided (mandatory)
        if (!cancellationReason || cancellationReason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Cancellation reason is required"
            });
        }

        const order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if order can be cancelled
        if (order.status === 'Delivered') {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel delivered orders. Please use return option instead."
            });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: "Order is already cancelled"
            });
        }

        // Collect items to be cancelled and increment stock
        let cancelledItems = [];
        let itemsUpdated = 0;
        
        for (let i = 0; i < order.orderedItems.length; i++) {
            const item = order.orderedItems[i];

            // Only cancel items that are not already cancelled, returned, or in return process
            if (!item.status || item.status === 'Pending' || item.status === 'Processing') {
                // Increment stock for cancelled product
                const product = await Product.findById(item.product._id);
                if (product) {
                    const variantIndex = product.variant.findIndex(v => v.size === item.size);
                    if (variantIndex !== -1) {
                        product.variant[variantIndex].varientquantity += item.quantity;
                        await product.save();
                    }
                }

                // Collect cancelled item for coupon calculation
                cancelledItems.push({
                    price: item.price || 0,
                    quantity: item.quantity || 1
                });

                order.orderedItems[i].status = 'Cancelled';
                order.orderedItems[i].cancellationReason = cancellationReason.trim();
                itemsUpdated++;
            }
        }

        // Calculate total refund amount with proper coupon discount handling
        let totalRefundAmount = 0;
        if (cancelledItems.length > 0) {
            if (order.couponApplied && order.couponDiscount > 0) {
                const couponCalculation = calculateEqualCouponDiscount(order, cancelledItems);
                totalRefundAmount = couponCalculation.adjustedRefundAmount;
            } else {
                totalRefundAmount = cancelledItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            }
        }

        if (itemsUpdated === 0) {
            return res.status(400).json({
                success: false,
                message: "No eligible items found to cancel"
            });
        }

        // Handle immediate refund for ONLINE and WALLET payments (no admin approval needed for cancellations)
        if (["ONLINE", "WALLET"].includes(order.paymentMethod) && totalRefundAmount > 0) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            
            const currentWalletBalance = user.wallet || 0;
            const newWalletBalance = currentWalletBalance + totalRefundAmount;
            await User.findByIdAndUpdate(userId, { wallet: newWalletBalance });
            
            const WalletTransaction = require("../../models/walletTransactionSchema");
            const transactionMetadata = {
                orderAmount: order.finalAmount,
                itemsRefund: true,
                totalItemsRefunded: itemsUpdated,
                cancellationInitiatedBy: 'user',
                cancellationAt: new Date(),
                originalPaymentMethod: order.paymentMethod,
                couponApplied: order.couponApplied || false,
                autoRefund: true, // Mark as automatic refund for cancellation
                adminApprovalRequired: false
            };
            
            // Add payment method specific metadata
            if (order.paymentMethod === 'ONLINE') {
                transactionMetadata.razorpayPayment = true;
                transactionMetadata.razorpayOrderId = order.razorpayOrderId || null;
                transactionMetadata.razorpayPaymentId = order.razorpayPaymentId || null;
            }
            
            if (order.couponApplied && order.couponCode) {
                transactionMetadata.couponCode = order.couponCode;
                transactionMetadata.couponDiscount = order.couponDiscount || 0;
            }
            
            let description = `Automatic refund for ${itemsUpdated} cancelled items in order ${order.orderId || orderId}`;
            if (order.paymentMethod === 'ONLINE') {
                description += ` - Online payment refund`;
            } else if (order.paymentMethod === 'WALLET') {
                description += ` - Wallet payment refund`;
            }
            
            await WalletTransaction.create({
                userId: userId,
                type: 'credit',
                amount: totalRefundAmount,
                description: description,
                orderId: order.orderId || orderId,
                source: 'return_refund',
                balanceAfter: newWalletBalance,
                status: 'completed',
                metadata: transactionMetadata
            });
        }

        // Update order status if all items are cancelled
        const allItemsCancelled = order.orderedItems.every(item =>
            item.status === 'Cancelled' || item.status === 'Returned'
        );

        if (allItemsCancelled) {
            order.status = 'Cancelled';
            order.paymentStatus = 'Refunded';
            order.cancellationReason = cancellationReason.trim();
        }

        await order.save();

        let message = `${itemsUpdated} item(s) cancelled successfully. Stock has been restored.`;
        if (totalRefundAmount > 0) {
            message += ` ₹${totalRefundAmount.toLocaleString('en-IN')} has been automatically credited to your wallet.`;
        }

        res.json({
            success: true,
            message: message,
            itemsUpdated: itemsUpdated
        });

    } catch (error) {
        console.error("Error cancelling all items:", error);
        res.status(500).json({ success: false, message: "Failed to cancel items" });
    }
}

// Return Individual Item
const returnItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, itemId, returnReason } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Validate that return reason is provided (mandatory)
        if (!returnReason || returnReason.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Return reason is required"
            });
        }

        const order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Find the specific item to return
        const itemIndex = order.orderedItems.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }

        const item = order.orderedItems[itemIndex];

        // Check if item can be returned
        if (item.status === 'Return Request' || item.status === 'Returned' || item.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: "This item cannot be returned"
            });
        }

        if (order.status !== 'Delivered' && item.status !== 'Delivered' && !(order.status === 'Delivered' && (!item.status || item.status === 'Pending' || item.status === 'Processing'))) {
            return res.status(400).json({
                success: false,
                message: "Only delivered items can be returned"
            });
        }

        // Update item status and add return reason (pending admin approval)
        order.orderedItems[itemIndex].status = 'Return Request';
        order.orderedItems[itemIndex].returnReason = returnReason.trim();
        order.orderedItems[itemIndex].adminApprovalStatus = 'Pending';

        await order.save();

        res.json({ success: true, message: "Return request submitted successfully. Awaiting admin approval." });

    } catch (error) {
        console.error("Error submitting return request:", error);
        res.status(500).json({ success: false, message: "Failed to submit return request" });
    }
}

// Return All Items in an Order
const returnAllItems = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, returnReason } = req.body;

        console.log("Return all items request:", { orderId, returnReason, userId });

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        if (!returnReason || returnReason.trim() === '') {
            return res.status(400).json({ success: false, message: "Return reason is required" });
        }

        const order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("Order found:", order.orderId, "Status:", order.status);
        console.log("Items before update:", order.orderedItems.map(item => ({ 
            id: item._id, 
            status: item.status, 
            productName: item.product?.productName 
        })));

        let itemsUpdated = 0;
        for (let i = 0; i < order.orderedItems.length; i++) {
            const item = order.orderedItems[i];
            
            // Check if item is eligible for return
            // Item is eligible if:
            // 1. Order status is 'Delivered' AND item has no status, 'Pending', 'Processing', or 'Delivered' status
            // 2. OR item status is explicitly 'Delivered'
            // 3. AND item is not already in return/cancelled state
            const isEligible = (
                (order.status === 'Delivered' && (!item.status || item.status === 'Pending' || item.status === 'Processing' || item.status === 'Delivered')) ||
                item.status === 'Delivered'
            ) && 
            item.status !== 'Return Request' &&
            item.status !== 'Returned' &&
            item.status !== 'Cancelled';

            console.log(`Item ${i}:`, {
                productName: item.product?.productName,
                itemStatus: item.status,
                orderStatus: order.status,
                isEligible: isEligible
            });

            if (isEligible) {
                order.orderedItems[i].status = 'Return Request';
                order.orderedItems[i].returnReason = returnReason.trim();
                order.orderedItems[i].adminApprovalStatus = 'Pending';
                itemsUpdated++;
                console.log(`Updated item ${i} to Return Request`);
            }
        }

        console.log("Items updated:", itemsUpdated);

        if (itemsUpdated === 0) {
            return res.status(400).json({ success: false, message: "No eligible items found to return" });
        }

        await order.save();
        console.log("Order saved successfully");

        res.json({ 
            success: true, 
            message: `Return request submitted for ${itemsUpdated} item(s). Awaiting admin approval.`, 
            itemsUpdated 
        });
    } catch (error) {
        console.error("Error submitting return all items request:", error);
        res.status(500).json({ success: false, message: "Failed to submit return all items request" });
    }
}

// Download Invoice PDF
const downloadInvoice = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.redirect("/login");
        }

        // Find the order
        const order = await Order.findOne({
            orderId: orderId,
            userId: userId
        }).populate({
            path: 'orderedItems.product',
            populate: { path: 'category', model: 'Category' }
        });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Check if order is delivered - invoice only available after delivery
        if (order.status !== 'Delivered') {
            return res.status(403).send(`
                <html>
                    <head>
                        <title>Invoice Not Available</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                text-align: center; 
                                padding: 50px; 
                                background-color: #f8f9fa; 
                            }
                            .container { 
                                max-width: 500px; 
                                margin: 0 auto; 
                                background: white; 
                                padding: 40px; 
                                border-radius: 10px; 
                                box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
                            }
                            .icon { 
                                font-size: 4rem; 
                                color: #ffc107; 
                                margin-bottom: 20px; 
                            }
                            h1 { 
                                color: #333; 
                                margin-bottom: 20px; 
                            }
                            p { 
                                color: #666; 
                                line-height: 1.6; 
                                margin-bottom: 30px; 
                            }
                            .btn { 
                                background: #667eea; 
                                color: white; 
                                padding: 12px 24px; 
                                text-decoration: none; 
                                border-radius: 6px; 
                                display: inline-block; 
                                transition: background 0.3s; 
                            }
                            .btn:hover { 
                                background: #5a6fd8; 
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="icon">📄</div>
                            <h1>Invoice Not Available</h1>
                            <p>Invoice will be available after delivery. Your order status is currently: <strong>${order.status}</strong></p>
                            <a href="/orders" class="btn">Back to Orders</a>
                        </div>
                    </body>
                </html>
            `);
        }

        // Get user data
        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).send('User not found');
        }

        // Get user address
        const addressData = await Address.findOne({ userId: userId });
        let deliveryAddress = null;
        if (addressData && addressData.adress.length > 0) {
            // Find default address or use first address
            deliveryAddress = addressData.adress.find(addr => addr.isDefault) || addressData.adress[0];
        }

        // Import PDFKit
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.orderId}.pdf"`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Company Header
        doc.fontSize(24)
           .fillColor('#667eea')
           .text('1NOTONE', 50, 50)
           .fontSize(10)
           .fillColor('#666666')
           .text('Premium Fashion Store', 50, 80)
           .text('Email: support@1notone.com', 50, 95)
           .text('Phone: +91-XXXXXXXXXX', 50, 110);

        // Invoice Title
        doc.fontSize(20)
           .fillColor('#333333')
           .text('INVOICE', 400, 50);

        // Invoice Details
        doc.fontSize(10)
           .fillColor('#666666')
           .text(`Invoice #: ${order.orderId}`, 400, 80)
           .text(`Date: ${new Date(order.createdOn).toLocaleDateString('en-IN')}`, 400, 95)
           .text(`Status: ${order.status}`, 400, 110)
           .text(`Payment: ${order.paymentMethod}`, 400, 125);

        // Line separator
        doc.moveTo(50, 150)
           .lineTo(550, 150)
           .strokeColor('#cccccc')
           .stroke();

        // Customer Information
        let yPosition = 170;
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Bill To:', 50, yPosition);

        yPosition += 20;
        doc.fontSize(10)
           .fillColor('#666666')
           .text(`Name: ${userData.name}`, 50, yPosition)
           .text(`Email: ${userData.email}`, 50, yPosition + 15);

        if (userData.phone) {
            doc.text(`Phone: ${userData.phone}`, 50, yPosition + 30);
            yPosition += 45;
        } else {
            yPosition += 30;
        }

        // Delivery Address
        if (deliveryAddress) {
            doc.fontSize(12)
               .fillColor('#333333')
               .text('Ship To:', 300, 170);

            doc.fontSize(10)
               .fillColor('#666666')
               .text(`${deliveryAddress.name}`, 300, 190)
               .text(`${deliveryAddress.landmark}`, 300, 205)
               .text(`${deliveryAddress.city}, ${deliveryAddress.state}`, 300, 220)
               .text(`${deliveryAddress.pincode}`, 300, 235)
               .text(`Phone: ${deliveryAddress.phone}`, 300, 250);
        }

        yPosition = Math.max(yPosition, 280);

        // Table Header
        doc.rect(50, yPosition, 500, 25)
           .fillColor('#f8f9fa')
           .fill();

        doc.fontSize(10)
           .fillColor('#333333')
           .text('Product', 60, yPosition + 8)
           .text('Qty', 300, yPosition + 8)
           .text('Price', 350, yPosition + 8)
           .text('Total', 450, yPosition + 8);

        yPosition += 25;

        // Table Content
        let subtotal = 0;
        order.orderedItems.forEach((item, index) => {
            // Calculate item price with offers
            let variant = null;
            if (item.product && item.product.variant && item.size) {
                variant = item.product.variant.find(v => v.size == item.size);
            }
            let productOffer = item.product.productOffer || 0;
            let categoryOffer = (item.product.category && item.product.category.categoryOffer) || 0;
            let bestOffer = Math.max(productOffer, categoryOffer);
            let variantPrice = variant && typeof variant.varientPrice === 'number' ? variant.varientPrice : (typeof item.price === 'number' ? item.price : 0);
            let displayPrice = bestOffer > 0 ? Math.round(variantPrice - (variantPrice * bestOffer / 100)) : Math.round(variantPrice);
            let itemTotal = Math.round(displayPrice * item.quantity);
            subtotal += itemTotal;

            // Add new page if needed
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            // Alternate row background
            if (index % 2 === 0) {
                doc.rect(50, yPosition, 500, 20)
                   .fillColor('#f8f9fa')
                   .fill();
            }

            doc.fontSize(9)
               .fillColor('#333333')
               .text(item.product.productName.substring(0, 35), 60, yPosition + 5)
               .text(item.quantity.toString(), 300, yPosition + 5)
               .text(`₹${Math.round(displayPrice).toLocaleString('en-IN')}`, 350, yPosition + 5)
               .text(`₹${Math.round(itemTotal).toLocaleString('en-IN')}`, 450, yPosition + 5);

            if (item.size) {
                doc.fontSize(8)
                   .fillColor('#666666')
                   .text(`Size: ${item.size}`, 60, yPosition + 15);
            }

            yPosition += 25;
        });

        // Summary Section
        yPosition += 20;
        
        // Line separator
        doc.moveTo(300, yPosition)
           .lineTo(550, yPosition)
           .strokeColor('#cccccc')
           .stroke();

        yPosition += 15;

        // Subtotal
        doc.fontSize(10)
           .fillColor('#333333')
           .text('Subtotal:', 350, yPosition)
           .text(`₹${Math.round(subtotal).toLocaleString('en-IN')}`, 450, yPosition);

        yPosition += 15;

        // Shipping
        doc.text('Shipping:', 350, yPosition)
           .text('Free', 450, yPosition);

        yPosition += 15;

        // Coupon Discount
        if (order.couponApplied && order.couponDiscount > 0) {
            doc.fillColor('#28a745')
               .text(`Discount (${order.couponCode}):`, 350, yPosition)
               .text(`-₹${order.couponDiscount.toLocaleString('en-IN')}`, 450, yPosition);
            yPosition += 15;
        }

        // Total
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Total:', 350, yPosition)
           .text(`₹${Math.round(order.finalAmount).toLocaleString('en-IN')}`, 450, yPosition);

        // Footer
        yPosition += 50;
        doc.fontSize(8)
           .fillColor('#666666')
           .text('Thank you for shopping with 1NOTONE!', 50, yPosition)
           .text('For any queries, contact us at support@1notone.com', 50, yPosition + 15)
           .text('This is a computer generated invoice.', 50, yPosition + 30);

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
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
    loadAddAddress,
    addAddress,
    setDefaultAddress,
    loadeditAddress,
    editAddress,
    deleteAddress,
    loadOrders,
    loadOrderDetails,
    loadWallet,
    loadChangePassword,
    loadReferral,
    loadCoupons,
    sendEmailOTP,
    loadVerifyEmailOTP,
    verifyEmailOTP,
    changePassword,
    loadEditProfile,
    updateProfile,
    cancelOrder,
    cancelItem,
    cancelAllItems,
    returnOrder,
    returnItem,
    returnAllItems,
    downloadInvoice
}
