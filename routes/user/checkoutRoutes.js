// User checkout and payment routes
const express = require("express");
const router = express.Router();
const checkoutController = require("../../controllers/user/checkoutController");
const paymentController = require("../../controllers/user/paymentController");
const { userAuth } = require("../../middlewares/auth");

// Checkout Management
router.get("/", userAuth, checkoutController.loadCheckout);
router.post("/", userAuth, checkoutController.processCheckout);
router.post("/buy-now", userAuth, checkoutController.buyNow);
router.get("/confirmation/:orderId", userAuth, checkoutController.loadThankYou);

// Payment Management
router.post("/create-razorpay-order", userAuth, paymentController.createRazorpayOrder);
router.post("/verify-payment", userAuth, paymentController.verifyPayment);
router.post("/retry-payment", userAuth, paymentController.retryPayment);
router.post("/handle-payment-failure", userAuth, paymentController.handlePaymentFailure);
router.get("/retry-payment/:orderId", userAuth, checkoutController.loadRetryPayment);
router.get("/payment-success/:orderId", userAuth, checkoutController.loadPaymentSuccess);
router.get("/payment-failure", checkoutController.loadPaymentFailure);

module.exports = router;