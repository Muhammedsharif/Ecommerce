// User authentication routes
const express = require("express");
const router = express.Router();
const passport = require('passport');
const userController = require("../../controllers/user/userController");

// User Registration and Authentication Routes
router.get("/signup", userController.loadSignup); // Display signup form
router.post("/signup", userController.signup); // Process signup form submission
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/google", passport.authenticate('google', {scope: ['profile', 'email']}));
router.get('/google/callback', passport.authenticate('google', {failureRedirect: '/auth/signup'}),
    userController.googleCallbackHandler
);

// Login Management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

module.exports = router;