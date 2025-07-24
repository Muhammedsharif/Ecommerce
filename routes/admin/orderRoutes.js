// Admin order management routes
const express = require('express');
const router = express.Router();
const orderController = require("../../controllers/admin/orderController");
const { adminAuth } = require('../../middlewares/auth');

// Order Management
router.get("/", adminAuth, orderController.getOrderPage);
router.post("/update-status", adminAuth, orderController.updateOrderStatus);
router.get("/details/:orderId", adminAuth, orderController.getOrderDetails);
router.get("/return-requests", adminAuth, orderController.getReturnRequestsPage);
router.post("/approve-return-request", adminAuth, orderController.approveReturnRequest);
router.post("/reject-return-request", adminAuth, orderController.rejectReturnRequest);
router.post("/approve-item-cancellation", adminAuth, orderController.approveItemCancellation);
router.post("/reject-item-cancellation", adminAuth, orderController.rejectItemCancellation);

module.exports = router;