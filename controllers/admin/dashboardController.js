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
            { $match: { status: 'Delivered', paymentStatus: 'Completed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
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

// Get sales chart data
const getSalesChartData = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        let dateRange = {};
        let groupBy = {};
        
        const now = new Date();
        
        switch (period) {
            case 'daily':
                // Last 7 days
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                dateRange = { createdOn: { $gte: sevenDaysAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        month: { $month: '$createdOn' },
                        day: { $dayOfMonth: '$createdOn' }
                    },
                    totalSales: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'weekly':
                // Last 8 weeks
                const eightWeeksAgo = new Date();
                eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
                dateRange = { createdOn: { $gte: eightWeeksAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        week: { $week: '$createdOn' }
                    },
                    totalSales: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'monthly':
                // Last 12 months
                const twelveMonthsAgo = new Date();
                twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
                dateRange = { createdOn: { $gte: twelveMonthsAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' },
                        month: { $month: '$createdOn' }
                    },
                    totalSales: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
                
            case 'yearly':
                // Last 5 years
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
                dateRange = { createdOn: { $gte: fiveYearsAgo, $lte: now } };
                groupBy = {
                    _id: {
                        year: { $year: '$createdOn' }
                    },
                    totalSales: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    date: { $first: '$createdOn' }
                };
                break;
        }

        const salesData = await Order.aggregate([
            { 
                $match: { 
                    ...dateRange,
                    status: 'Delivered',
                    paymentStatus: 'Completed'
                } 
            },
            { $group: groupBy },
            { $sort: { '_id': 1 } }
        ]);

        // Format data for chart
        const chartData = salesData.map(item => {
            let label = '';
            if (period === 'daily') {
                label = `${item._id.day}/${item._id.month}`;
            } else if (period === 'weekly') {
                label = `Week ${item._id.week}`;
            } else if (period === 'monthly') {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                label = monthNames[item._id.month - 1];
            } else if (period === 'yearly') {
                label = item._id.year.toString();
            }
            
            return {
                label,
                sales: item.totalSales,
                orders: item.orderCount
            };
        });

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
            { $match: { status: 'Delivered', paymentStatus: 'Completed' } },
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
            { $match: { status: 'Delivered', paymentStatus: 'Completed' } },
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

// Get top 10 best-selling brands
const getTopBrands = async (req, res) => {
    try {
        const topBrands = await Order.aggregate([
            { $match: { status: 'Delivered', paymentStatus: 'Completed' } },
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
                    _id: '$product.brand',
                    totalQuantity: { $sum: '$orderedItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            {
                $project: {
                    brandName: '$_id',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: topBrands
        });
    } catch (error) {
        console.error("Error getting top brands:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get top brands"
        });
    }
};

// Get ledger book data
const getLedgerData = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            status, 
            customer,
            page = 1,
            limit = 20
        } = req.query;

        const skip = (page - 1) * limit;
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
                amount: order.totalPrice,
                discount: order.couponDiscount || 0,
                netAmount: order.totalPrice - (order.couponDiscount || 0),
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
    getTopBrands,
    getLedgerData
};