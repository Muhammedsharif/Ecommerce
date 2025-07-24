// User wishlist management routes
const express = require("express");
const router = express.Router();
const wishlistController = require("../../controllers/user/wishlistController");
const { userAuth } = require("../../middlewares/auth");

// Wishlist Management
router.get("/", userAuth, wishlistController.loadWishlist);
router.post("/add", userAuth, wishlistController.addToWishlist);
router.get('/remove', userAuth, wishlistController.removeProduct);
router.get("/count", wishlistController.getWishlistCount);

module.exports = router;