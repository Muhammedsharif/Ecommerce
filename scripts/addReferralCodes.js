const mongoose = require('mongoose');
const User = require('../models/userSchema');

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for migration');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Generate unique referral code
const generateReferralCode = (userName, userId) => {
    const namePrefix = userName.substring(0, 3).toUpperCase();
    const userIdSuffix = userId.toString().slice(-4);
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `${namePrefix}${userIdSuffix}${randomSuffix}`;
};

// Migration function to add referral codes to existing users
const addReferralCodesToUsers = async () => {
    try {
        console.log('Starting referral code migration...');
        
        // Find all users without referral codes
        const usersWithoutReferralCodes = await User.find({
            $or: [
                { referralCode: { $exists: false } },
                { referralCode: null },
                { referralCode: '' }
            ]
        });

        console.log(`Found ${usersWithoutReferralCodes.length} users without referral codes`);

        let successCount = 0;
        let errorCount = 0;

        for (const user of usersWithoutReferralCodes) {
            try {
                let referralCode;
                let isUnique = false;
                let attempts = 0;

                // Try to generate unique referral code
                while (!isUnique && attempts < 10) {
                    referralCode = generateReferralCode(user.name, user._id);
                    const existingUser = await User.findOne({ referralCode });
                    if (!existingUser) {
                        isUnique = true;
                    }
                    attempts++;
                }

                if (!isUnique) {
                    console.error(`Failed to generate unique referral code for user ${user._id}`);
                    errorCount++;
                    continue;
                }

                // Update user with referral code and initialize fields
                await User.findByIdAndUpdate(user._id, {
                    referralCode,
                    referralCount: 0,
                    coupons: []
                });

                console.log(`✓ Added referral code ${referralCode} for user ${user.name} (${user.email})`);
                successCount++;

            } catch (error) {
                console.error(`Error processing user ${user._id}:`, error);
                errorCount++;
            }
        }

        

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    require('dotenv').config();
    connectDB().then(() => {
        addReferralCodesToUsers();
    });
}

module.exports = { addReferralCodesToUsers };
