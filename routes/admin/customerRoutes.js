// Admin customer management routes
const express = require('express');
const router = express.Router();
const customerController = require("../../controllers/admin/customerController");
const { adminAuth } = require('../../middlewares/auth');

// Customer Management
router.get("/", adminAuth, customerController.customerInfo);
router.get("/block", adminAuth, customerController.customerBlocked);
router.get("/unblock", adminAuth, customerController.customerunBlocked);

module.exports = router;