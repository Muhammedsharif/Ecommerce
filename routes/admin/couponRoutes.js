// Admin coupon management routes
const express = require('express');
const router = express.Router();
const couponController = require("../../controllers/admin/couponController");
const { adminAuth } = require('../../middlewares/auth');

// Coupon Management
router.get("/", adminAuth, couponController.getCouponListPage);
router.get("/add", adminAuth, couponController.getAddCouponPage);
router.post("/add", adminAuth, couponController.addCoupon);
router.get("/edit", adminAuth, couponController.getEditCoupon);
router.put("/edit/:id", adminAuth, couponController.editCoupon);
router.delete("/delete/:id", adminAuth, couponController.deleteCoupon);
router.get("/categories", adminAuth, couponController.getCategories);
router.get("/products", adminAuth, couponController.getProducts);
router.get("/usage/:id", adminAuth, couponController.getCouponUsageDetails);

module.exports = router;