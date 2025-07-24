// User referral system routes
const express = require("express");
const router = express.Router();
const referralController = require("../../controllers/user/referralController");
const { userAuth } = require("../../middlewares/auth");

// Referral System Routes
router.get("/info", userAuth, referralController.getUserReferralInfo);

module.exports = router;