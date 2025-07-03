const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")

// Enhanced admin orders page controller with pagination, filtering, and sorting
const getOrderPage = async (req, res) => {
    try {
        // Extract query parameters for pagination, search, and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const status = req.query.status || "";
        const sortBy = req.query.sortBy || "createdOn";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        // Build search and filter query
        let matchQuery = {};

        // Status filter
        if (status && status !== "all") {
            matchQuery.status = status;
        }

        // Search functionality - search by order ID or customer details
        let searchQuery = {};
        if (search) {
            // First, find users matching the search term
            const matchingUsers = await User.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } }
                ]
            }).select("_id");

            const userIds = matchingUsers.map(user => user._id);

            searchQuery = {
                $or: [
                    { orderId: { $regex: search, $options: "i" } },
                    { userId: { $in: userIds } }
                ]
            };
        }

        // Combine match and search queries
        const finalQuery = { ...matchQuery, ...searchQuery };

        // Get orders with pagination and population
        const orders = await Order.find(finalQuery)
            .populate({
                path: "userId",
                select: "name email phone"
            })
            .populate({
                path: "orderedItems.product",
                select: "productName productImage"
            })
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(finalQuery);
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate order statistics
        const orderStats = await Order.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" }
                }
            }
        ]);

        // Format statistics for easy access
        const stats = {
            total: totalOrders,
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0,
            totalRevenue: 0
        };

        orderStats.forEach(stat => {
            const status = stat._id.toLowerCase();
            if (stats.hasOwnProperty(status)) {
                stats[status] = stat.count;
            }
            stats.totalRevenue += stat.totalAmount;
        });

        // Get recent orders for dashboard summary
        const recentOrders = await Order.find()
            .populate("userId", "name email")
            .sort({ createdOn: -1 })
            .limit(5)
            .lean();

        res.render("admin-orders", {
            orders: orders,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            limit: limit,
            search: search,
            status: status,
            sortBy: sortBy,
            sortOrder: req.query.sortOrder || "desc",
            stats: stats,
            recentOrders: recentOrders
        });

    } catch (error) {
        console.error("Error loading admin orders page:", error);
        res.redirect("/pageerror");
    }
};

// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        // Validate status
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }

        // Find and update the order
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Update the order status
        order.status = status;
        await order.save();

        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            newStatus: status
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update order status"
        });
    }
};

// Get detailed order information
const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId: orderId })
            .populate({
                path: "userId",
                select: "name email phone"
            })
            .populate({
                path: "orderedItems.product",
                select: "productName productImage brand category"
            })
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            order: order
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order details"
        });
    }
};

module.exports = {
    getOrderPage,
    updateOrderStatus,
    getOrderDetails
}