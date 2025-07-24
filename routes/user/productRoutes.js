// User product-related routes
const express = require("express");
const router = express.Router();
const userController = require("../../controllers/user/userController");
const productController = require("../../controllers/user/productController");
const { userAuth } = require("../../middlewares/auth");

// Home page & Shopping page
router.get("/", userController.loadHomepage);
router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userController.filterProducts);
router.post("/search", userAuth, userController.searchProduct);
router.get('/list', userAuth, userController.getAllProducts);

// Product Management
router.get("/details", userAuth, productController.loadProductDetails);

module.exports = router;