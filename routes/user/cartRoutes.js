// User cart management routes
const express = require("express");
const router = express.Router();
const cartController = require("../../controllers/user/cartController");
const { userAuth } = require("../../middlewares/auth");

// Cart Management
router.get("/", userAuth, cartController.loadCart);
router.post("/add", userAuth, cartController.addToCart);
router.get("/count", cartController.getCartCount);
router.post("/update-quantity", userAuth, cartController.updateCartQuantity);
router.delete("/remove", userAuth, cartController.removeFromCart);
router.delete("/empty", userAuth, cartController.emptyCart);
router.post("/move-from-wishlist", userAuth, cartController.moveToCartFromWishlist);

module.exports = router;