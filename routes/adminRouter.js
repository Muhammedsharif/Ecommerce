const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require("../controllers/admin/customerController");
const productController = require("../controllers/admin/productController");
const categoryController = require("../controllers/admin/categoryController");
const orderController = require("../controllers/admin/orderController")
const bannerController = require("../controllers/admin/bannerController")
const couponController = require("../controllers/admin/couponController")
const multer = require("multer");
const storage = require("../helpers/multer")
const uploads = multer({storage:storage})
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

//Product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);
router.patch('/deleteProduct/:id',adminAuth, productController.deleteProduct);
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unblockProduct",adminAuth,productController.unblockProduct)
router.get("/editProduct",productController.getEditProduct) // Temporarily disabled auth for debugging
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

//Order Management
router.get("/orders",adminAuth,orderController.getOrderPage)
router.post("/update-order-status",adminAuth,orderController.updateOrderStatus)
router.get("/order-details/:orderId",adminAuth,orderController.getOrderDetails)
router.get("/return-requests",adminAuth,orderController.getReturnRequestsPage)
router.post("/approve-return-request",adminAuth,orderController.approveReturnRequest)
router.post("/reject-return-request",adminAuth,orderController.rejectReturnRequest)

//Banner Management
router.get("/banner",adminAuth,bannerController.getBannerPage)
router.get("/addBanner",adminAuth,bannerController.getAddBannerPage)
router.post("/addBanner",adminAuth,uploads.single("images"),bannerController.addBanner)

//Coupon Management
router.get("/coupons",adminAuth,couponController.getCouponListPage)
router.get("/add-coupon",adminAuth,couponController.getAddCouponPage)
router.post("/add-coupon",adminAuth,couponController.addCoupon)
router.get("/edit-coupon",adminAuth,couponController.getEditCoupon)
router.put("/edit-coupon/:id",adminAuth,couponController.editCoupon)
router.delete("/delete-coupon/:id",adminAuth,couponController.deleteCoupon)
router.get("/get-categories",adminAuth,couponController.getCategories)
router.get("/get-products",adminAuth,couponController.getProducts)

module.exports = router;