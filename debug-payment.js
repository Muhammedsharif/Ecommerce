// Debug script to test payment verification
const mongoose = require('mongoose');
const Order = require('./models/orderSchema');

async function debugPayment() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce');
        
        // Find failed orders
        const failedOrders = await Order.find({ paymentStatus: 'Failed' }).limit(5);
        console.log('Failed orders found:', failedOrders.length);
        
        failedOrders.forEach(order => {
            console.log('Order ID:', order.orderId);
            console.log('User ID:', order.userId);
            console.log('Items:', order.orderedItems.length);
            console.log('Total:', order.finalAmount);
            console.log('---');
        });
        
    } catch (error) {
        console.error('Debug error:', error);
    } finally {
        mongoose.disconnect();
    }
}

debugPayment();