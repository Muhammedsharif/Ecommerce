/**
 * Helper functions for coupon discount calculations during returns and cancellations
 * For percentage discounts, the total discount is divided equally among all products
 * For flat discounts, the current logic is maintained
 */

/**
 * Calculate equal coupon discount for returned/canceled items
 * @param {Object} order - The order object
 * @param {Array} returnedItems - Array of returned/canceled items with their quantities
 * @returns {Object} - Object containing equal discount and adjusted refund amount
 */
const calculateEqualCouponDiscount = (order, returnedItems) => {
    // If no coupon was applied, return zero discount
    if (!order.couponApplied || !order.couponDiscount || order.couponDiscount === 0) {
        return {
            equalDiscount: 0,
            adjustedRefundAmount: returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            returnedItemsValue: returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
    }

    // Calculate total number of products in the order (considering quantities)
    const totalProductCount = order.orderedItems.reduce((sum, item) => {
        return sum + item.quantity;
    }, 0);

    // For percentage discounts, divide equally among all products
    // For flat discounts, use the same equal distribution logic
    const discountPerProduct = order.couponDiscount / totalProductCount;

    // Calculate total number of returned/canceled products
    const returnedProductCount = returnedItems.reduce((sum, item) => {
        return sum + item.quantity;
    }, 0);

    // Calculate equal coupon discount for returned items
    const equalDiscount = discountPerProduct * returnedProductCount;

    // Calculate total value of returned/canceled items
    const returnedItemsValue = returnedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    // Calculate adjusted refund amount (item value minus equal discount)
    const adjustedRefundAmount = returnedItemsValue - equalDiscount;

    return {
        equalDiscount: Math.round(equalDiscount), // Round to nearest whole number
        adjustedRefundAmount: Math.round(adjustedRefundAmount),
        returnedItemsValue: Math.round(returnedItemsValue),
        discountPerProduct: Math.round(discountPerProduct),
        returnedProductCount: returnedProductCount,
        totalProductCount: totalProductCount
    };
};

/**
 * Calculate equal coupon discount for a single item
 * @param {Object} order - The order object
 * @param {Object} item - The item being returned/canceled
 * @returns {Object} - Object containing equal discount and adjusted refund amount
 */
const calculateSingleItemCouponDiscount = (order, item) => {
    return calculateEqualCouponDiscount(order, [{
        price: item.price,
        quantity: item.quantity
    }]);
};

/**
 * Calculate proportional coupon discount for returned/canceled items (legacy function for backward compatibility)
 * @param {Object} order - The order object
 * @param {Array} returnedItems - Array of returned/canceled items with their quantities
 * @returns {Object} - Object containing proportional discount and adjusted refund amount
 */
const calculateProportionalCouponDiscount = (order, returnedItems) => {
    // Use equal distribution instead of proportional for consistency
    const result = calculateEqualCouponDiscount(order, returnedItems);
    return {
        proportionalDiscount: result.equalDiscount,
        adjustedRefundAmount: result.adjustedRefundAmount,
        returnedItemsValue: result.returnedItemsValue,
        totalOrderValue: order.orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
};

/**
 * Update order coupon discount after partial returns/cancellations
 * @param {Object} order - The order object
 * @param {Number} proportionalDiscount - The proportional discount amount to subtract
 * @returns {Object} - Updated order with adjusted coupon discount
 */
const updateOrderCouponDiscount = (order, proportionalDiscount) => {
    if (order.couponApplied && order.couponDiscount > 0) {
        // Reduce the coupon discount by the proportional amount
        order.couponDiscount = Math.max(0, order.couponDiscount - proportionalDiscount);
        
        // If coupon discount becomes 0, mark coupon as no longer applied
        if (order.couponDiscount === 0) {
            order.couponApplied = false;
            order.couponCode = null;
        }
        
        // Recalculate final amount
        const remainingItemsValue = order.orderedItems
            .filter(item => item.status !== 'Cancelled' && item.status !== 'Returned')
            .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        order.finalAmount = remainingItemsValue - order.couponDiscount;
    }
    
    return order;
};

/**
 * Calculate the current order total based on non-returned/non-cancelled items
 * @param {Object} order - The order object
 * @returns {Object} - Object containing current totals and breakdown
 */
const calculateCurrentOrderTotal = (order) => {
    // Calculate total for remaining (non-returned/non-cancelled) items
    const remainingItems = order.orderedItems.filter(item => 
        item.status !== 'Cancelled' && item.status !== 'Returned'
    );
    
    const remainingItemsValue = remainingItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
    
    // Current coupon discount (already adjusted for returned items)
    const currentCouponDiscount = order.couponDiscount || 0;
    
    // Calculate current final amount
    const currentFinalAmount = remainingItemsValue - currentCouponDiscount;
    
    return {
        remainingItemsValue,
        currentCouponDiscount,
        currentFinalAmount: Math.max(0, currentFinalAmount),
        remainingItemsCount: remainingItems.length,
        totalItemsCount: order.orderedItems.length
    };
};

/**
 * Calculate display totals for order views (handles partial returns/cancellations)
 * @param {Object} order - The order object
 * @returns {Object} - Object containing display totals
 */
const getOrderDisplayTotals = (order) => {
    const currentTotals = calculateCurrentOrderTotal(order);
    
    // If all items are returned/cancelled, show original amounts but with zero final amount
    if (currentTotals.remainingItemsCount === 0) {
        return {
            subtotal: order.totalPrice || 0,
            couponDiscount: 0,
            finalAmount: 0,
            isFullyReturned: true,
            remainingItemsValue: 0
        };
    }
    
    // If some items are returned/cancelled, show adjusted amounts
    if (currentTotals.remainingItemsCount < currentTotals.totalItemsCount) {
        return {
            subtotal: currentTotals.remainingItemsValue,
            couponDiscount: currentTotals.currentCouponDiscount,
            finalAmount: currentTotals.currentFinalAmount,
            isPartiallyReturned: true,
            remainingItemsValue: currentTotals.remainingItemsValue
        };
    }
    
    // No returns/cancellations, show original amounts
    return {
        subtotal: order.totalPrice || 0,
        couponDiscount: order.couponDiscount || 0,
        finalAmount: order.finalAmount || 0,
        isFullyActive: true,
        remainingItemsValue: order.totalPrice || 0
    };
};

module.exports = {
    calculateEqualCouponDiscount,
    calculateProportionalCouponDiscount,
    calculateSingleItemCouponDiscount,
    updateOrderCouponDiscount,
    calculateCurrentOrderTotal,
    getOrderDisplayTotals
};