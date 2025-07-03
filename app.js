// Main application entry point - E-commerce Node.js application
const express=require("express")
const app=express()
const path=require("path")
const env=require("dotenv").config() // Load environment variables
const session=require("express-session") // Session management
const passport = require('./config/passport'); // Authentication configuration
const db=require("./config/db") // Database connection
const userRouter=require("./routes/userRouter") // User-facing routes
const adminRouter=require("./routes/adminRouter") // Admin panel routes
const addWishlistCount = require('./middlewares/wishlistCount') // Middleware for wishlist count
db() // Initialize database connection


// Middleware configuration
app.use(express.json()) // Parse JSON request bodies
app.use(express.urlencoded({extended:true})) // Parse URL-encoded request bodies

// Session configuration for user authentication
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000 // 72 hours session expiry
    }
}))

// Initialize Passport.js for authentication
app.use(passport.initialize())
app.use(passport.session())

app.use((req,res,next)=>{
    res.set('cache-control','no-store')

    next()
})

// Add wishlist count to all views
app.use(addWishlistCount)

app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "views/user"),
  path.join(__dirname, "views/admin"),
]);
app.use(express.static('public'));


app.use("/",userRouter)
app.use("/admin",adminRouter)

const PORT =process.env.PORT || 3000
app.listen(PORT,()=>console.log(`Server running at ${PORT}`))

module.exports=app