// User profile management routes
const express = require("express");
const router = express.Router();
const profileController = require("../../controllers/user/profileController");
const { userAuth } = require("../../middlewares/auth");
const profileUpload = require("../../helpers/profileMulter");

// Password Management
router.get("/forgot-password", profileController.loadForgotPassword);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-password-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.loadResetPassword);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.post("/reset-password", profileController.resetPassword);

// Profile Management
router.get("/", userAuth, profileController.userProfile);
router.get("/change-password", userAuth, profileController.loadChangePassword);
router.post("/change-password", userAuth, profileController.changePassword);
router.get("/referral", userAuth, profileController.loadReferral);

// Email Change Routes
router.post("/send-email-otp", userAuth, profileController.sendEmailOTP);
router.get("/verify-email-otp", userAuth, profileController.loadVerifyEmailOTP);
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOTP);

// Edit Profile Routes
router.get("/edit", userAuth, profileController.loadEditProfile);

// Handle profile image upload with error handling
router.post("/edit", userAuth, (req, res, next) => {
    profileUpload.single('profileImage')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            
            // Handle different types of Multer errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: 'File size too large. Please select an image smaller than 5MB.',
                    errorType: 'FILE_SIZE_LIMIT'
                });
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    success: false,
                    error: 'Unexpected file field. Please try again.',
                    errorType: 'UNEXPECTED_FILE'
                });
            } else if (err.message.includes('Only image files are allowed')) {
                return res.status(400).json({
                    success: false,
                    error: 'Only image files are allowed! Please select a valid image file.',
                    errorType: 'INVALID_FILE_TYPE'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: err.message || 'File upload error. Please try again.',
                    errorType: 'UPLOAD_ERROR'
                });
            }
        }
        
        // If no error, proceed to the controller
        next();
    });
}, profileController.updateProfile);

// Coupons
router.get("/coupons", userAuth, profileController.loadCoupons);

module.exports = router;