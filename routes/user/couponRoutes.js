// User coupon management routes
const express = require("express");
const router = express.Router();
const couponController = require("../../controllers/user/couponController");
const { userAuth } = require("../../middlewares/auth");

// Coupon Management
router.post("/apply", userAuth, couponController.applyCoupon);
router.post("/remove", userAuth, couponController.removeCoupon);
router.get("/applied", userAuth, couponController.getAppliedCoupon);
router.get("/available", userAuth, couponController.getAvailableCoupons);

module.exports = router;