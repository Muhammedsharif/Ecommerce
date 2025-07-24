// Main user router - imports and organizes all user-related route modules
const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productController");
const cartController = require("../controllers/user/cartController");
const wishlistController = require("../controllers/user/wishlistController");
const { userAuth } = require("../middlewares/auth");

// Import route modules
const authRoutes = require("./user/authRoutes");
const productRoutes = require("./user/productRoutes");
const profileRoutes = require("./user/profileRoutes");
const orderRoutes = require("./user/orderRoutes");
const addressRoutes = require("./user/addressRoutes");
const wishlistRoutes = require("./user/wishlistRoutes");
const cartRoutes = require("./user/cartRoutes");
const checkoutRoutes = require("./user/checkoutRoutes");
const couponRoutes = require("./user/couponRoutes");
const walletRoutes = require("./user/walletRoutes");
const referralRoutes = require("./user/referralRoutes");

// Error page route (keep at root level)
router.get("/pageNotFound", userController.pageNotFound);

// Essential routes that need to remain at root level for existing functionality
router.get("/", userController.loadHomepage);
router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userController.filterProducts);
router.post("/search", userAuth, userController.searchProduct);
router.get('/products', userAuth, userController.getAllProducts);
router.get("/productDetails", userAuth, productController.loadProductDetails);

// Legacy cart routes that need to remain at root level for backward compatibility
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/add-to-cart", userAuth, cartController.addToCart);

// Legacy wishlist routes that need to remain at root level for backward compatibility
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist);

// Mount route modules with prefixes for better organization
router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/profile", profileRoutes);
router.use("/orders", orderRoutes);
router.use("/address", addressRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/cart", cartRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/coupons", couponRoutes);
router.use("/wallet", walletRoutes);
router.use("/referral", referralRoutes);

module.exports = router;