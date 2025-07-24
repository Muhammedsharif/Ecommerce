// Admin sales report routes
const express = require('express');
const router = express.Router();
const salesReportController = require("../../controllers/admin/salesReportController");
const { adminAuth } = require('../../middlewares/auth');

// Sales Report Routes
router.get("/", adminAuth, salesReportController.getSalesReportDashboard);
router.get("/data", adminAuth, salesReportController.generateSalesReport);
router.get("/download/pdf", adminAuth, salesReportController.downloadPDFReport);
router.get("/download/excel", adminAuth, salesReportController.downloadExcelReport);

module.exports = router;