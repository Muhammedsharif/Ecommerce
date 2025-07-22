
const calculateEqualCouponDiscount = (order, returnedItems) => {
    // If no coupon was applied, return zero discount
    if (!order.couponApplied || !order.couponDiscount || order.couponDiscount === 0) {
        return {
            equalDiscount: 0,
            adjustedRefundAmount: returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            returnedItemsValue: returnedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
    }

    const totalProductCount = order.orderedItems.reduce((sum, item) => {
        return sum + item.quantity;
    }, 0);

    const discountPerProduct = order.couponDiscount / totalProductCount;

    // Calculate total number of returned/canceled products
    const returnedProductCount = returnedItems.reduce((sum, item) => {
        return sum + item.quantity;
    }, 0);

   
    const equalDiscount = discountPerProduct * returnedProductCount;

    const returnedItemsValue = returnedItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    // Calculate adjusted refund amount (item value minus equal discount)
    const adjustedRefundAmount = returnedItemsValue - equalDiscount;

    return {
        equalDiscount: Math.round(equalDiscount), 
        adjustedRefundAmount: Math.round(adjustedRefundAmount),
        returnedItemsValue: Math.round(returnedItemsValue),
        discountPerProduct: Math.round(discountPerProduct),
        returnedProductCount: returnedProductCount,
        totalProductCount: totalProductCount
    };
};


const calculateSingleItemCouponDiscount = (order, item) => {
    return calculateEqualCouponDiscount(order, [{
        price: item.price,
        quantity: item.quantity
    }]);
};


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


const getOrderDisplayTotals = (order) => {
    // Calculate total for remaining (non-returned/non-cancelled) items
    const remainingItems = order.orderedItems.filter(item => 
        item.status !== 'Cancelled' && item.status !== 'Returned'
    );
    
    const cancelledOrReturnedItems = order.orderedItems.filter(item => 
        item.status === 'Cancelled' || item.status === 'Returned'
    );
    
    const remainingItemsValue = remainingItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);
    
    // If all items are returned/cancelled, show zero amounts
    if (remainingItems.length === 0) {
        return {
            subtotal: 0,
            couponDiscount: 0,
            finalAmount: 0,
            isFullyReturned: true,
            remainingItemsValue: 0
        };
    }
    
    // If some items are returned/cancelled and coupon was applied, calculate equal distribution
    if (cancelledOrReturnedItems.length > 0 && order.couponApplied && order.couponDiscount > 0) {
        
        const totalProductCount = order.orderedItems.reduce((sum, item) => {
            return sum + item.quantity;
        }, 0);
        
      
        const remainingProductCount = remainingItems.reduce((sum, item) => {
            return sum + item.quantity;
        }, 0);
        
        
        const discountPerProduct = order.couponDiscount / totalProductCount;
        
        // Calculate coupon discount for remaining items (equal distribution)
        const remainingCouponDiscount = Math.round(discountPerProduct * remainingProductCount);
        
        const adjustedFinalAmount = remainingItemsValue - remainingCouponDiscount;
        
        return {
            subtotal: remainingItemsValue,
            couponDiscount: remainingCouponDiscount,
            finalAmount: Math.max(0, adjustedFinalAmount),
            isPartiallyReturned: true,
            remainingItemsValue: remainingItemsValue,
            originalCouponDiscount: order.couponDiscount,
            discountPerProduct: Math.round(discountPerProduct),
            remainingProductCount: remainingProductCount,
            totalProductCount: totalProductCount
        };
    }
    
    // No returns/cancellations, show original amounts
    return {
        subtotal: order.totalPrice || remainingItemsValue,
        couponDiscount: order.couponDiscount || 0,
        finalAmount: order.finalAmount || (remainingItemsValue - (order.couponDiscount || 0)),
        isFullyActive: true,
        remainingItemsValue: remainingItemsValue
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