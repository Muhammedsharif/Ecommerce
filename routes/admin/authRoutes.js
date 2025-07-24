// Admin authentication routes
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/adminController');
const { adminAuth } = require('../../middlewares/auth');

// Login Management
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

// Dashboard
router.get("/dashboard", adminAuth, adminController.loadDashboard);

module.exports = router;