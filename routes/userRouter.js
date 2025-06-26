const express=require("express")
const router=express.Router()
const passport = require('passport');
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController")
const productController=require("../controllers/user/productController")
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










module.exports=router