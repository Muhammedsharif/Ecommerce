const Razorpay = require('razorpay');

// Initialize Razorpay instance with API keys
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_your_key_id', // Replace with your actual key
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_key_secret' // Replace with your actual secret
});

module.exports = razorpay;
