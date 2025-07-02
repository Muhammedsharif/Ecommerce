const express=require("express")
const router=express.Router()
const passport = require('passport');
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController")
const productController=require("../controllers/user/productController")
const wishlistController=require("../controllers/user/wishlistController")
const cartController=require("../controllers/user/cartController")
const { userAuth } = require("../middlewares/auth");




router.get("/pageNotFound",userController.pageNotFound)

//SignUp Management
router.get("/pageNotFound",userController.pageNotFound)
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
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
router.get("/",userAuth,userController.loadHomepage)
router.get("/shop",userAuth,userController.loadShoppingPage)
router.get("/filter",userAuth,userController.filterProducts)
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
router.post("/test-cart", (req, res) => {
    console.log("TEST ROUTE HIT:", req.body);
    res.json({ success: true, message: "Test route works", body: req.body });
})
router.post("/update-cart-quantity",userAuth,cartController.updateCartQuantity)
router.post("/remove-from-cart",userAuth,cartController.removeFromCart)
router.post("/empty-cart",userAuth,cartController.emptyCart)
router.post("/move-to-cart-from-wishlist",userAuth,cartController.moveToCartFromWishlist)










module.exports=router