const User = require("../models/userSchema")

const userAuth =  (req,res,next) =>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
              req.session.destroy()
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("Error in userAuth middleware")
            res.status(500).send("Internal Server Error")
        })
    }else{
        res.redirect("/login")
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


const adminAuth = (req, res, next) => {
    if ( req.session.admin) {
        return next();
    }
    res.redirect('/admin/login');
}


module.exports = {
    userAuth,
    adminAuth
}