const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const env = require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},

async (accessToken, refreshToken, profile, done) => {
    try {
        // First check if user exists with this Google ID
        let user = await User.findOne({googleId: profile.id});
        
        if (user) {
            return done(null, user);
        }
        
        // Check if user exists with this email (from regular signup)
        const existingUser = await User.findOne({email: profile.emails[0].value});
        
        if (existingUser) {
            // User exists with this email but no Google ID - link the accounts
            existingUser.googleId = profile.id;
            await existingUser.save();
            return done(null, existingUser);
        }
        
        // No existing user found - create new user
        user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            wishlist: [], // Explicitly initialize wishlist as empty array
            cart: [], // Explicitly initialize cart as empty array
            orderHistory: [], // Explicitly initialize orderHistory as empty array
            coupons: [], // Explicitly initialize coupons as empty array
            searchHistory: [] // Explicitly initialize searchHistory as empty array
        });
        
        try {
            await user.save();
            return done(null, user);
        } catch (saveError) {
            // Handle duplicate key error specifically
            if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.email) {
                // Race condition: another user was created with this email between our check and save
                // Try to find and link the account again
                const raceConditionUser = await User.findOne({email: profile.emails[0].value});
                if (raceConditionUser) {
                    raceConditionUser.googleId = profile.id;
                    await raceConditionUser.save();
                    return done(null, raceConditionUser);
                }
            }
            throw saveError; // Re-throw if it's a different error
        }
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
    .then(user => {
        done(null, user);
    })
    .catch(err => {
        done(err, null);
    });
});

module.exports = passport;