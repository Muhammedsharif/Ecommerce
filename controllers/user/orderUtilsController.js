const Order = require("../../models/orderSchema");

// Get Updated Order Totals
const getUpdatedTotals = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        // Find the order
        let order = await Order.findOne({ _id: orderId, userId: userId }).populate('orderedItems.product');
        if (!order) {
            order = await Order.findOne({ orderId: orderId, userId: userId }).populate('orderedItems.product');
        }
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Calculate display totals for order views (handles partial returns/cancellations)
        const { getOrderDisplayTotals } = require("../../helpers/couponHelper");
        const displayTotals = getOrderDisplayTotals(order);
        
        res.json({
            success: true,
            totals: {
                subtotal: displayTotals.subtotal,
                couponDiscount: displayTotals.couponDiscount,
                finalAmount: displayTotals.finalAmount,
                couponCode: order.couponCode
            }
        });

    } catch (error) {
        console.error("Error getting updated totals:", error);
        res.status(500).json({ success: false, message: "Failed to get updated totals" });
    }
}

module.exports = {
    getUpdatedTotals
};