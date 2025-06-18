const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const {userAuth, adminAuth} = require('../middlewares/auth');


router.get("/pageerror",adminController.pageerror)
//Login Management
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)
//Customer Management
router.get("/users",adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)
//Category Management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.geteditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)
router.post("/deletecategory", adminAuth,categoryController.deleteCategory);
module.exports = router;