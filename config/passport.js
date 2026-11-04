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
     
        let user = await User.findOne({googleId: profile.id});
        
        if (user) {
            return done(null, user);
        }
       
        const existingUser = await User.findOne({email: profile.emails[0].value});
        
        if (existingUser) {
            
            existingUser.googleId = profile.id;
            await existingUser.save();
            return done(null, existingUser);
        }
    
        user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            wishlist: [],
            cart: [], 
            orderHistory: [],
            coupons: [], 
            searchHistory: [] 
        });
        
        try {
            await user.save();
            return done(null, user);
        } catch (saveError) {
            
            if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.email) {
                const raceConditionUser = await User.findOne({email: profile.emails[0].value});
                if (raceConditionUser) {
                    raceConditionUser.googleId = profile.id;
                    await raceConditionUser.save();
                    return done(null, raceConditionUser);
                }
            }
            throw saveError; 
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