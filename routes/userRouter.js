const express=require("express")
const router=express.Router()
const passport = require('passport');
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController")
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
router.get("/",userController.loadHomepage)
router.get("/shop",userAuth,userController.loadShoppingPage)

//Profile Management
 router.get("/Profile",userAuth,profileController.userProfile)








module.exports=router