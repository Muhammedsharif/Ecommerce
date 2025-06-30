const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
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

        if (newPassword.length < 8) {
            return res.render("changePassword", {
                user: user,
                page: 'password',
                error: "Password must be at least 8 characters long"
            });
        }

        // Verify current password
        
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
    loadAddAddress,
    addAddress,
    setDefaultAddress,
    loadeditAddress,
    editAddress,
    deleteAddress,
    loadOrders,
    loadWallet,
    loadChangePassword,
    loadReferral,
    sendEmailOTP,
    loadVerifyEmailOTP,
    verifyEmailOTP,
    changePassword
}