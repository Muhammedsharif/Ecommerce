const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");

// Generate unique referral code
const generateReferralCode = (userName, userId) => {
    const namePrefix = userName.substring(0, 3).toUpperCase();
    const userIdSuffix = userId.toString().slice(-4);
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `${namePrefix}${userIdSuffix}${randomSuffix}`;
};

// Create referral code for user
const createReferralCode = async (userId, userName) => {
    try {
        let referralCode;
        let isUnique = false;
        let attempts = 0;

        // Try to generate unique referral code
        while (!isUnique && attempts < 10) {
            referralCode = generateReferralCode(userName, userId);
            const existingUser = await User.findOne({ referralCode });
            if (!existingUser) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            throw new Error('Unable to generate unique referral code');
        }

        return referralCode;
    } catch (error) {
        console.error('Error creating referral code:', error);
        return null;
    }
};

// Create referral reward coupon
const createReferralCoupon = async (userId, type = 'referrer') => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Generate unique coupon code
        const couponCode = `REF${type.toUpperCase()}${Date.now().toString().slice(-6)}`;
        
        // Create reward coupon
        const rewardCoupon = new Coupon({
            name: couponCode,
            discountType: 'flat',
            offerPrice: type === 'referrer' ? 100 : 50, // Referrer gets ₹100, referee gets ₹50
            minimumPrice: 500, // Minimum order ₹500
            startDate: new Date(),
            expireOn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days validity
            isAllCategories: true,
            isAllProducts: true,
            maxUsesPerUser: 1,
            totalUsageLimit: 1,
            islist: true
        });

        await rewardCoupon.save();
        return rewardCoupon;

    } catch (error) {
        console.error('Error creating referral coupon:', error);
        return null;
    }
};

// Process referral when new user signs up
const processReferral = async (newUserId, referralCode) => {
    try {
        if (!referralCode) return;

        // Find the referrer
        const referrer = await User.findOne({ referralCode: referralCode.trim() });
        if (!referrer) {
            console.log('Invalid referral code:', referralCode);
            return;
        }

        // Prevent self-referral
        if (referrer._id.toString() === newUserId.toString()) {
            console.log('Self-referral attempt blocked');
            return;
        }

        // Update new user with referrer info
        await User.findByIdAndUpdate(newUserId, {
            referredBy: referrer._id
        });

        // Create coupons for both users
        const referrerCoupon = await createReferralCoupon(referrer._id, 'referrer');
        const refereeCoupon = await createReferralCoupon(newUserId, 'referee');

        // Add coupons to users
        if (referrerCoupon) {
            await User.findByIdAndUpdate(referrer._id, {
                $push: {
                    coupons: {
                        couponId: referrerCoupon._id,
                        isUsed: false,
                        receivedDate: new Date()
                    }
                },
                $inc: { referralCount: 1 }
            });
        }

        if (refereeCoupon) {
            await User.findByIdAndUpdate(newUserId, {
                $push: {
                    coupons: {
                        couponId: refereeCoupon._id,
                        isUsed: false,
                        receivedDate: new Date()
                    }
                }
            });
        }

        console.log(`Referral processed successfully: ${referrer.name} referred new user`);
        return { success: true, referrerCoupon, refereeCoupon };

    } catch (error) {
        console.error('Error processing referral:', error);
        return { success: false, error: error.message };
    }
};

// Get user's referral information
const getUserReferralInfo = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to view referral information"
            });
        }

        const user = await User.findById(userId)
            .populate('coupons.couponId')
            .select('referralCode referralCount coupons');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Filter unused coupons
        const availableCoupons = user.coupons.filter(coupon => 
            !coupon.isUsed && 
            coupon.couponId && 
            new Date(coupon.couponId.expireOn) > new Date()
        );

        res.json({
            success: true,
            referralCode: user.referralCode,
            referralCount: user.referralCount || 0,
            availableCoupons: availableCoupons.length,
            coupons: availableCoupons.map(coupon => ({
                id: coupon.couponId._id,
                code: coupon.couponId.name,
                discount: coupon.couponId.offerPrice,
                minimumOrder: coupon.couponId.minimumPrice,
                expiryDate: coupon.couponId.expireOn,
                receivedDate: coupon.receivedDate
            }))
        });

    } catch (error) {
        console.error('Error getting referral info:', error);
        res.status(500).json({
            success: false,
            message: "Failed to get referral information"
        });
    }
};

module.exports = {
    createReferralCode,
    processReferral,
    createReferralCoupon,
    getUserReferralInfo
};
