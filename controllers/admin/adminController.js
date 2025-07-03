const User = require("../../models/userSchema");
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")


const pageerror = async (req, res) => {
    res.render("admin-error")
}



const loadLogin = async (req, res) => {

    const error = req.query.message;
const email = req.query.email;
const password = req.query.password;1
    if(req.session.admin){
        return res.redirect("/admin/dashboard");
    }
 
    res.render("adminlogin",{  error, email,password })
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Backend-side validation
        if (!email || !password) {
            return res.redirect(`/admin/login?message=All fields are required&email=${email}`);
        }

        // Simple email format check (optional)
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.redirect(`/admin/login?message=Invalid email format&email=${email}`);
        }

        // Find admin user
        const admin = await User.findOne({ email, isAdmin: true });
       

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect("/admin/dashboard");
            } else {
                return res.redirect(`/admin/login?message=Invalid password&email=${email}`);
            }
        } else {
            return res.redirect(`/admin/login?message=Admin not found&email=${email}`);
        }

    } catch (error) {
        console.log("Login error", error);
        return res.redirect("/pageerror");
    }
};

const loadDashboard = async (req,res) =>{
    
    if(req.session.admin){
        try {
           
            res.render("dashboard");
        } catch (error) {
            res.redirect("/pageerror");
        }
    }
}


const logout = async (req, res) => {
    try {
        // Only clear admin session data, preserve user session if exists
        delete req.session.admin;

        // Save the session to ensure the deletion is persisted
        req.session.save((err) => {
            if (err) {
                console.log("Error in logout", err);
                return res.redirect("/pageerror");
            }
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.log("Error in logout", error);
        res.redirect("/pageerror");
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,

}
