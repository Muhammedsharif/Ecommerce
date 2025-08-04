

const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config(); // Load environment variables
const morgan = require("morgan");
const session = require("express-session");
const passport = require('./config/passport');
const db = require("./config/db");
const { registerRoutes } = require("./routes/index");
const addWishlistCount = require('./middlewares/wishlistCount');

// Connect to MongoDB
db();

// Middleware configuration
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// app.use(morgan("combined"));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000 // 72 hours
    }
}));

// Passport.js initialization
app.use(passport.initialize());
app.use(passport.session());

// Prevent caching
app.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    next();
});

// Add wishlist count to views
app.use(addWishlistCount);

// View engine setup
app.set("view engine", "ejs");
app.set("views", [
    path.join(__dirname, "views/user"),
    path.join(__dirname, "views/admin"),
]);
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register all routes

registerRoutes(app);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at ${PORT}`));

module.exports = app;
