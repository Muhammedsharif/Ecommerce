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
router.post("/edit", userAuth, profileUpload.single('profileImage'), profileController.updateProfile);

// Coupons
router.get("/coupons", userAuth, profileController.loadCoupons);

module.exports = router;