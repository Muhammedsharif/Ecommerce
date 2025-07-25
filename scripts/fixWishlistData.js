// Script to fix wishlist data for existing users
const mongoose = require('mongoose');
const User = require('../models/userSchema');
require('dotenv').config();

async function fixWishlistData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all users
        const users = await User.find({});
        console.log(`Found ${users.length} users`);

        let fixedCount = 0;

        for (const user of users) {
            let needsUpdate = false;

            // Check if wishlist is not an array or is undefined
            if (!Array.isArray(user.wishlist)) {
                console.log(`Fixing wishlist for user ${user._id} (${user.email})`);
                user.wishlist = [];
                needsUpdate = true;
            }

            // Check other array fields too
            if (!Array.isArray(user.cart)) {
                console.log(`Fixing cart for user ${user._id} (${user.email})`);
                user.cart = [];
                needsUpdate = true;
            }

            if (!Array.isArray(user.orderHistory)) {
                console.log(`Fixing orderHistory for user ${user._id} (${user.email})`);
                user.orderHistory = [];
                needsUpdate = true;
            }

            if (!Array.isArray(user.coupons)) {
                console.log(`Fixing coupons for user ${user._id} (${user.email})`);
                user.coupons = [];
                needsUpdate = true;
            }

            if (!Array.isArray(user.searchHistory)) {
                console.log(`Fixing searchHistory for user ${user._id} (${user.email})`);
                user.searchHistory = [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                await user.save();
                fixedCount++;
                console.log(`Fixed user ${user._id}`);
            }
        }

        console.log(`Fixed ${fixedCount} users`);
        console.log('Migration completed successfully');

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
fixWishlistData();