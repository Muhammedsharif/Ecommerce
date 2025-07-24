// Admin product management routes
const express = require('express');
const router = express.Router();
const productController = require("../../controllers/admin/productController");
const { adminAuth } = require('../../middlewares/auth');
const multer = require("multer");
const storage = require("../../helpers/multer");
const uploads = multer({storage: storage});

// Product Management
router.get("/add", adminAuth, productController.getProductAddPage);
router.post("/add", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get("/", adminAuth, productController.getAllProducts);
router.patch('/delete/:id', adminAuth, productController.deleteProduct);
router.get("/block", adminAuth, productController.blockProduct);
router.get("/unblock", adminAuth, productController.unblockProduct);
router.get("/edit", productController.getEditProduct); // Temporarily disabled auth for debugging
router.patch("/edit/:id", adminAuth, uploads.array("images", 4), productController.editProduct);
router.post("/delete-image", adminAuth, productController.deleteSingleImage);

module.exports = router;