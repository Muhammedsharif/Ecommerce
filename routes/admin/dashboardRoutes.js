// Admin dashboard analytics routes
const express = require('express');
const router = express.Router();
const dashboardController = require("../../controllers/admin/dashboardController");
const { adminAuth } = require('../../middlewares/auth');

// Dashboard Analytics Routes
router.get("/analytics", adminAuth, dashboardController.getDashboard);
router.get("/analytics/stats", adminAuth, dashboardController.getDashboardStats);
router.get("/analytics/sales-chart", adminAuth, dashboardController.getSalesChartData);
router.get("/analytics/top-products", adminAuth, dashboardController.getTopProducts);
router.get("/analytics/top-categories", adminAuth, dashboardController.getTopCategories);
router.get("/analytics/ledger", adminAuth, dashboardController.getLedgerData);

// Add a root route for dashboard
router.get("/", adminAuth, dashboardController.getDashboard);

module.exports = router;