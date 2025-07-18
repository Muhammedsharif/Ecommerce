// User-facing routes configuration for the e-commerce application
const express=require("express")
const router=express.Router()
const passport = require('passport'); // Authentication middleware
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController")
const productController=require("../controllers/user/productController")
const wishlistController=require("../controllers/user/wishlistController")
const cartController=require("../controllers/user/cartController")
const checkoutController=require("../controllers/user/checkoutController")
const paymentController=require("../controllers/user/paymentController")
const couponController=require("../controllers/user/couponController")
const referralController=require("../controllers/user/referralController")
const { userAuth } = require("../middlewares/auth"); // User authentication middleware
const profileUpload = require("../helpers/profileMulter"); // Profile image upload helper

// Error page route
router.get("/pageNotFound",userController.pageNotFound)

// User Registration and Authentication Routes
router.get("/pageNotFound",userController.pageNotFound)
router.get("/signup",userController.loadSignup) // Display signup form
router.post("/signup",userController.signup) // Process signup form submission
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),

userController.googleCallbackHandler
)

//Login Management
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout)

//Home page & Shopping page
router.get("/",userController.loadHomepage)
router.get("/shop",userController.loadShoppingPage)
router.get("/filter",userController.filterProducts)
router.post("/search",userAuth,userController.searchProduct)
router.get('/products',userAuth,userController.getAllProducts);



//Product Management
router.get("/productDetails",userAuth,productController.loadProductDetails)

//Profile Management
router.get("/forgot-Password",profileController.loadForgotPassword)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-password-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.loadResetPassword)
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.resetPassword)
router.get("/Profile",userAuth,profileController.userProfile)

// Additional Profile Pages

router.get("/orders",userAuth,profileController.loadOrders)
router.get("/wallet",userAuth,profileController.loadWallet)
router.get("/change-password",userAuth,profileController.loadChangePassword)
router.post("/change-password",userAuth,profileController.changePassword)
router.get("/referral",userAuth,profileController.loadReferral)

// Email Change Routes
router.post("/send-email-otp",userAuth,profileController.sendEmailOTP)
router.get("/verify-email-otp",userAuth,profileController.loadVerifyEmailOTP)
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOTP)

// Edit Profile Routes
router.get("/edit-profile",userAuth,profileController.loadEditProfile)
router.post("/edit-profile",userAuth,profileUpload.single('profileImage'),profileController.updateProfile)

// Order Management Routes
router.get("/order-details/:orderId",userAuth,profileController.loadOrderDetails)
router.post("/cancel-order",userAuth,profileController.cancelOrder)
router.post("/cancel-item",userAuth,profileController.cancelItem)
router.post("/cancel-all-items",userAuth,profileController.cancelAllItems)
router.post("/return-order",userAuth,profileController.returnOrder)
router.post("/return-item",userAuth,profileController.returnItem)
router.post("/return-all-items", userAuth, profileController.returnAllItems);

//Address Management
router.get("/address",userAuth,profileController.loadAddress)
router.get("/addAddress",userAuth,profileController.loadAddAddress)
router.post("/addAddress",userAuth,profileController.addAddress)
router.post("/setDefaultAddress",userAuth,profileController.setDefaultAddress)
router.get("/editAddress",userAuth,profileController.loadeditAddress)
router.post("/editAddress",userAuth,profileController.editAddress)
router.get("/deleteAddress",userAuth,profileController.deleteAddress)

//Whishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist)
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist)
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct)


//Cart Management
router.get("/cart",userAuth,cartController.loadCart)
router.post("/addToCart",cartController.addToCart)
router.post("/add-to-cart",cartController.addToCart)
router.get("/cart-count",cartController.getCartCount)
// Test route

router.post("/update-cart-quantity",userAuth,cartController.updateCartQuantity)
router.delete("/remove-from-cart",userAuth,cartController.removeFromCart)
router.delete("/empty-cart",userAuth,cartController.emptyCart)
router.post("/move-to-cart-from-wishlist",userAuth,cartController.moveToCartFromWishlist)

//Checkout Management
router.get("/checkout",userAuth,checkoutController.loadCheckout)
router.post("/checkout",userAuth,checkoutController.processCheckout)
router.get("/order-confirmation/:orderId",userAuth,checkoutController.loadThankYou)

//Coupon Management
router.post("/apply-coupon",userAuth,couponController.applyCoupon)
router.post("/remove-coupon",userAuth,couponController.removeCoupon)
router.get("/get-applied-coupon",userAuth,couponController.getAppliedCoupon)
router.get("/get-available-coupons",userAuth,couponController.getAvailableCoupons)

//Payment Management
router.post("/create-razorpay-order",userAuth,paymentController.createRazorpayOrder)
router.post("/verify-payment",userAuth,paymentController.verifyPayment)
router.post("/retry-payment",userAuth,paymentController.retryPayment)
router.post("/handle-payment-failure",userAuth,paymentController.handlePaymentFailure)
router.get("/retry-payment/:orderId",userAuth,checkoutController.loadRetryPayment)
router.get("/payment-success/:orderId",userAuth,checkoutController.loadPaymentSuccess)
router.get("/payment-failure",checkoutController.loadPaymentFailure)
router.get("/download-invoice/:orderId",userAuth,profileController.downloadInvoice)

//Wallet Management
router.get("/wallet",userAuth,profileController.loadWallet)







// Referral System Routes
router.get("/referral/info", userAuth, referralController.getUserReferralInfo)
router.get("/coupons", userAuth, profileController.loadCoupons)

module.exports=router