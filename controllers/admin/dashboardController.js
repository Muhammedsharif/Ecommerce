const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const mongoose = require("mongoose");

// Get dashboard with analytics
const getDashboard = async (req, res) => {
    try {
        res.render("dashboard-analytics", {
            title: "Admin Dashboard - Analytics"
        });
    } catch (error) {
        console.error("Error loading dashboard:", error);
        res.redirect("/admin/pageerror");
    }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
    try {
        // Get basic stats
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalProducts = await Product.countDocuments({ isDeleted: false });
        const totalCategories = await Category.countDocuments({ isListed: true });
        
        // Get orders stats
        const totalOrders = await Order.countDocuments();
        const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
        const pendingOrders = await Order.countDocuments({ status: 'Pending' });
        const processingOrders = await Order.countDocuments({ status: 'Processing' });
        
        // Calculate total revenue from delivered orders
        const revenueResult = await Order.aggregate([
            { 
                $match: { 
                    status: 'Delivered',
                    $or: [
                        { paymentStatus: 'Completed' },
                        { paymentMethod: 'COD' }
                    ]
                } 
            },
            { $group: { _id: null, totalRevenue: { $sum: '$finalAmount' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalProducts,
                totalCategories,
                totalOrders,
                deliveredOrders,
                pendingOrders,
                processingOrders,
                totalRevenue
            }
        });
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load dashboard stats"
        });
    }
};

// Helper function to get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get sales chart data
const getSalesChartData = async (req, res) => {
    try {
        const { period = 'daily' } = req.query;
        let dateRange = {};
        let groupBy = {};
        
        const now = new Date();
        now.setHours(23, 59, 59, 999); // End of today
        
        switch (period) {
            case 'daily':
                // Last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today, so -6 for 7 days total
                sevenDaysAgo.setHours(0, 0, 0, 0);
                dateRange = { createdOn: { $gte: sevenDaysAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        month: { $month: '$createdOn' },
                        day: { $dayOfMonth: '$createdOn' }
                    },
                    totalSales: { $sum: '$finalAmount' }, // Use finalAmount instead of totalPrice
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'weekly':
                // Last 8 weeks
                const eightWeeksAgo = new Date();
                eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 55); // 8 weeks = 56 days, but include current week
                eightWeeksAgo.setHours(0, 0, 0, 0);
                dateRange = { createdOn: { $gte: eightWeeksAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        week: { $week: '$createdOn' }
                    },
                    totalSales: { $sum: '$finalAmount' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'monthly':
                // Last 12 months
                const twelveMonthsAgo = new Date();
                twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11); // Include current month
                twelveMonthsAgo.setDate(1);
                twelveMonthsAgo.setHours(0, 0, 0, 0);
                dateRange = { createdOn: { $gte: twelveMonthsAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        month: { $month: '$createdOn' }
                    },
                    totalSales: { $sum: '$finalAmount' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'yearly':
                // Last 5 years
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 4); // Include current year
                fiveYearsAgo.setMonth(0, 1);
                fiveYearsAgo.setHours(0, 0, 0, 0);
                dateRange = { createdOn: { $gte: fiveYearsAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' }
                    },
                    totalSales: { $sum: '$finalAmount' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
        }

        // Get sales data with proper filtering
        const salesData = await Order.aggregate([
            { 
                $match: { 
                    ...dateRange,
                    status: { $in: ['Delivered', 'Processing', 'Shipped'] }, // Include more statuses for better data
                    $or: [
                        { paymentStatus: 'Completed' },
                        { paymentMethod: 'COD', status: 'Delivered' }
                    ]
                } 
            },
            { $group: groupBy },
            { $sort: { '_id': 1 } }
        ]);

        // Create complete data set with missing periods filled with zeros
        let chartData = [];
        
        if (period === 'daily') {
            // Generate last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dayData = salesData.find(item => 
                    item._id.year === date.getFullYear() &&
                    item._id.month === date.getMonth() + 1 &&
                    item._id.day === date.getDate()
                );
                
                chartData.push({
                    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    sales: dayData ? dayData.totalSales : 0,
                    orders: dayData ? dayData.orderCount : 0
                });
            }
        } else if (period === 'weekly') {
            // Generate last 8 weeks
            for (let i = 7; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - (i * 7));
                const year = date.getFullYear();
                const week = getWeekNumber(date);
                
                const weekData = salesData.find(item => 
                    item._id.year === year && item._id.week === week
                );
                
                chartData.push({
                    label: `Week ${week}`,
                    sales: weekData ? weekData.totalSales : 0,
                    orders: weekData ? weekData.orderCount : 0
                });
            }
        } else if (period === 'monthly') {
            // Generate last 12 months
            for (let i = 11; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthData = salesData.find(item => 
                    item._id.year === date.getFullYear() &&
                    item._id.month === date.getMonth() + 1
                );
                
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                
                chartData.push({
                    label: monthNames[date.getMonth()],
                    sales: monthData ? monthData.totalSales : 0,
                    orders: monthData ? monthData.orderCount : 0
                });
            }
        } else if (period === 'yearly') {
            // Generate last 5 years
            for (let i = 4; i >= 0; i--) {
                const year = new Date().getFullYear() - i;
                const yearData = salesData.find(item => item._id.year === year);
                
                chartData.push({
                    label: year.toString(),
                    sales: yearData ? yearData.totalSales : 0,
                    orders: yearData ? yearData.orderCount : 0
                });
            }
        }

        res.json({
            success: true,
            data: chartData
        });
    } catch (error) {
        console.error("Error getting sales chart data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get sales chart data"
        });
    }
};

// Get top 10 best-selling products
const getTopProducts = async (req, res) => {
    try {
        const topProducts = await Order.aggregate([
            { 
                $match: { 
                    status: 'Delivered',
                    $or: [
                        { paymentStatus: 'Completed' },
                        { paymentMethod: 'COD' }
                    ]
                } 
            },
            { $unwind: '$orderedItems' },
            {
                $group: {
                    _id: '$orderedItems.product',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $project: {
                    productName: '$product.productName',
                    productImage: { $arrayElemAt: ['$product.productImage', 0] },
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: topProducts
        });
    } catch (error) {
        console.error("Error getting top products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get top products"
        });
    }
};

// Get top 10 best-selling categories
const getTopCategories = async (req, res) => {
    try {
        const topCategories = await Order.aggregate([
            { 
                $match: { 
                    status: 'Delivered',
                    $or: [
                        { paymentStatus: 'Completed' },
                        { paymentMethod: 'COD' }
                    ]
                } 
            },
            { $unwind: '$orderedItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderedItems.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.category',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $project: {
                    categoryName: '$category.name',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: topCategories
        });
    } catch (error) {
        console.error("Error getting top categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get top categories"
        });
    }
};

// Get ledger book data with download functionality
const getLedgerData = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            status, 
            customer,
            page = 1,
            limit = 20,
            download = false
        } = req.query;

        let filter = {};

        // Date range filter
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdOn = { $gte: start, $lte: end };
        }

        // Status filter
        if (status && status !== 'all') {
            filter.status = status;
        }

        // Customer filter
        if (customer) {
            const users = await User.find({
                $or: [
                    { name: { $regex: customer, $options: 'i' } },
                    { email: { $regex: customer, $options: 'i' } }
                ]
            }).select('_id');
            
            if (users.length > 0) {
                filter.userId = { $in: users.map(user => user._id) };
            }
        }

        // For download, get all transactions without pagination
        if (download === 'true') {
            const transactions = await Order.find(filter)
                .populate('userId', 'name email')
                .populate('orderedItems.product', 'productName')
                .sort({ createdOn: -1 });

            // Process transactions for ledger format
            const ledgerEntries = transactions.map(order => {
                const productNames = order.orderedItems.map(item => 
                    item.product?.productName || 'Unknown Product'
                ).join(', ');

                return {
                    transactionId: order.orderId || order._id.toString().slice(-8),
                    date: order.createdOn,
                    customer: order.userId?.name || 'Unknown',
                    customerEmail: order.userId?.email || 'N/A',
                    type: getTransactionType(order.status),
                    description: `Order: ${productNames}`,
                    amount: order.totalPrice || order.finalAmount,
                    discount: order.couponDiscount || 0,
                    netAmount: (order.finalAmount || order.totalPrice) - (order.couponDiscount || 0),
                    status: order.status,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus
                };
            });

            res.json({
                success: true,
                data: {
                    transactions: ledgerEntries
                }
            });
            return;
        }

        // Regular pagination for display
        const skip = (page - 1) * limit;
        const totalTransactions = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalTransactions / limit);

        const transactions = await Order.find(filter)
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Process transactions for ledger format
        const ledgerEntries = transactions.map(order => {
            const productNames = order.orderedItems.map(item => 
                item.product?.productName || 'Unknown Product'
            ).join(', ');

            return {
                transactionId: order.orderId || order._id.toString().slice(-8),
                date: order.createdOn,
                customer: order.userId?.name || 'Unknown',
                customerEmail: order.userId?.email || 'N/A',
                type: getTransactionType(order.status),
                description: `Order: ${productNames}`,
                amount: order.totalPrice || order.finalAmount,
                discount: order.couponDiscount || 0,
                netAmount: (order.finalAmount || order.totalPrice) - (order.couponDiscount || 0),
                status: order.status,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus
            };
        });

        res.json({
            success: true,
            data: {
                transactions: ledgerEntries,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalTransactions,
                    limit: parseInt(limit),
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error("Error getting ledger data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get ledger data"
        });
    }
};

// Helper function to determine transaction type
const getTransactionType = (status) => {
    switch (status) {
        case 'Delivered':
            return 'Sale';
        case 'Cancelled':
            return 'Cancellation';
        case 'Returned':
            return 'Return';
        case 'Return Request':
            return 'Return Request';
        default:
            return 'Order';
    }
};

module.exports = {
    getDashboard,
    getDashboardStats,
    getSalesChartData,
    getTopProducts,
    getTopCategories,
    getLedgerData
};