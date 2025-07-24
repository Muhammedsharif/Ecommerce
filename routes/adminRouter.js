// Main admin router - imports and organizes all admin-related route modules
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { adminAuth } = require('../middlewares/auth');

// Import route modules
const authRoutes = require('./admin/authRoutes');
const customerRoutes = require('./admin/customerRoutes');
const categoryRoutes = require('./admin/categoryRoutes');
const productRoutes = require('./admin/productRoutes');
const orderRoutes = require('./admin/orderRoutes');
const bannerRoutes = require('./admin/bannerRoutes');
const couponRoutes = require('./admin/couponRoutes');
const dashboardRoutes = require('./admin/dashboardRoutes');
const salesReportRoutes = require('./admin/salesReportRoutes');

// Error page route (keep at root level)
router.get("/pageerror", adminController.pageerror);

// Keep some essential routes at root level for backward compatibility
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Import customer controller for backward compatibility routes
const customerController = require('../controllers/admin/customerController');

// Backward compatibility routes for block/unblock (old route patterns)
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Mount route modules with prefixes for better organization
router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/category", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/banner", bannerRoutes);
router.use("/coupons", couponRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/sales-report", salesReportRoutes);

module.exports = router;