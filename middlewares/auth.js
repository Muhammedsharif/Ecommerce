// Authentication middleware for user and admin access control
const User = require("../models/userSchema")

// Middleware to verify user authentication and check if user is not blocked
const userAuth =  (req,res,next) =>{
    if(req.session.user){
        // Check if user exists and is not blocked
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next(); // User is valid, proceed to next middleware/route
            }else{
                // Only clear user session data, preserve admin session if exists
                delete req.session.user;
                res.redirect("/auth/login")
            }
        })
        .catch(error=>{
            console.log("Error in userAuth middleware")
            res.status(500).send("Internal Server Error")
        })
    }else{
        // No user session found, redirect to login
        res.redirect("/auth/login")
    }
}

// const adminAuth = (req,res,next)=>{
//     User.findOne({isAdmin:true})
//     .then(data=>{
//         if(data){
//             next()

//         }else{
//             res.redirect("/admin/login")
//         }
//     })
//     .catch(error=>{
//         console.log("Error in adminAuth middleware",error)
//         res.status(500).send("Internal Server Error");
        
//     })

    
// }


// Middleware to verify admin authentication
const adminAuth = (req, res, next) => {
    if ( req.session.admin) {
        return next(); // Admin session exists, proceed
    }
    res.redirect('/admin/login'); // No admin session, redirect to admin login
}


module.exports = {
    userAuth,
    adminAuth
}