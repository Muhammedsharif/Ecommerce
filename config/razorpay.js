const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

// Safe debugging - secret value print cheyyunnilla
console.log('Razorpay Key ID loaded:', !!keyId);
console.log('Razorpay Key Secret loaded:', !!keySecret);
console.log('Razorpay Mode:', keyId?.startsWith('rzp_test_') ? 'TEST' :
    keyId?.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN');

if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing in .env');
}

const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
});

module.exports = razorpay;
