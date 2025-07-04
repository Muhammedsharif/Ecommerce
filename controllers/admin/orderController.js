const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const WalletTransaction = require("../../models/walletTransactionSchema")

// Enhanced admin orders page controller with pagination, filtering, and sorting
const getOrderPage = async (req, res) => {
    try {
        // Extract query parameters for pagination, search, and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
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

        // Get return request count for notification badge
        const returnRequestCount = await Order.countDocuments({ status: 'Return Request' });

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
            recentOrders: recentOrders,
            returnRequestCount: returnRequestCount
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

        // Find the order
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Implement status transition validation logic
        const currentStatus = order.status;
        const isValidTransition = validateStatusTransition(currentStatus, status);

        if (!isValidTransition.valid) {
            return res.status(400).json({
                success: false,
                message: isValidTransition.message
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

// Status transition validation function
const validateStatusTransition = (currentStatus, newStatus) => {
    // Define valid status transitions
    const statusTransitions = {
        'Pending': ['Processing', 'Cancelled'],
        'Processing': ['Shipped', 'Cancelled'],
        'Shipped': ['Delivered', 'Cancelled'],
        'Delivered': ['Return Request'], // Delivered orders can only go to Return Request
        'Cancelled': [], // Cancelled orders cannot be changed
        'Return Request': ['Returned', 'Delivered'], // Return requests can be approved (Returned) or rejected (back to Delivered)
        'Returned': [] // Returned orders cannot be changed
    };

    // Allow same status (no change)
    if (currentStatus === newStatus) {
        return { valid: true };
    }

    // Check if the transition is valid
    const allowedTransitions = statusTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
        // Provide specific error messages for common invalid transitions
        if (currentStatus === 'Delivered' && newStatus === 'Pending') {
            return {
                valid: false,
                message: "Cannot change delivered orders back to pending status. Delivered orders can only be moved to 'Return Request' status."
            };
        } else if (currentStatus === 'Cancelled') {
            return {
                valid: false,
                message: "Cancelled orders cannot be modified."
            };
        } else if (currentStatus === 'Returned') {
            return {
                valid: false,
                message: "Returned orders cannot be modified."
            };
        } else {
            return {
                valid: false,
                message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowedTransitions.join(', ') || 'None'}.`
            };
        }
    }

    return { valid: true };
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

// Get return requests page with pagination and filtering
const getReturnRequestsPage = async (req, res) => {
    try {
        // Extract query parameters for pagination, search, and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "createdOn";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        // Build search query for return requests only
        let matchQuery = { status: 'Return Request' };

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

        // Get return requests with pagination and population
        const returnRequests = await Order.find(finalQuery)
            .populate({
                path: "userId",
                select: "name email phone"
            })
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count for pagination
        const totalReturnRequests = await Order.countDocuments(finalQuery);
        const totalPages = Math.ceil(totalReturnRequests / limit);

        // Get return request statistics
        const returnRequestStats = await Order.aggregate([
            { $match: { status: 'Return Request' } },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalAmount: { $sum: "$finalAmount" }
                }
            }
        ]);

        const stats = {
            totalRequests: returnRequestStats.length > 0 ? returnRequestStats[0].totalRequests : 0,
            totalAmount: returnRequestStats.length > 0 ? returnRequestStats[0].totalAmount : 0
        };

        res.render("admin-return-requests", {
            returnRequests: returnRequests,
            currentPage: page,
            totalPages: totalPages,
            totalReturnRequests: totalReturnRequests,
            limit: limit,
            search: search,
            sortBy: sortBy,
            sortOrder: req.query.sortOrder || "desc",
            stats: stats
        });

    } catch (error) {
        console.error("Error fetching return requests:", error);
        res.redirect("/pageerror");
    }
};

// Approve return request with wallet credit
const approveReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required"
            });
        }

        // Find the order with user details
        const order = await Order.findOne({ orderId: orderId }).populate('userId');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Validate current status
        if (order.status !== 'Return Request') {
            return res.status(400).json({
                success: false,
                message: "Order is not in return request status"
            });
        }

        // Get the user
        const user = await User.findById(order.userId._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Calculate refund amount (using finalAmount from order)
        const refundAmount = order.finalAmount;
        const currentWalletBalance = user.wallet || 0;
        const newWalletBalance = currentWalletBalance + refundAmount;

        // Update user wallet balance
        await User.findByIdAndUpdate(
            order.userId._id,
            { wallet: newWalletBalance }
        );

        // Create wallet transaction record
        await WalletTransaction.create({
            userId: order.userId._id,
            type: 'credit',
            amount: refundAmount,
            description: `Refund for returned order ${orderId}`,
            orderId: orderId,
            source: 'return_refund',
            balanceAfter: newWalletBalance,
            status: 'completed',
            metadata: {
                orderAmount: order.finalAmount,
                returnApprovedBy: 'admin',
                returnApprovedAt: new Date()
            }
        });

        // Update order status to 'Returned'
        await Order.findOneAndUpdate(
            { orderId: orderId },
            {
                status: 'Returned',
                returnApprovedAt: new Date(),
                updatedAt: new Date()
            }
        );

        res.json({
            success: true,
            message: `Return request approved successfully. ₹${refundAmount.toLocaleString('en-IN')} has been credited to the customer's wallet.`
        });

    } catch (error) {
        console.error("Error approving return request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while approving return request"
        });
    }
};

// Reject return request
const rejectReturnRequest = async (req, res) => {
    try {
        const { orderId, reason } = req.body;

        if (!orderId || !reason) {
            return res.status(400).json({
                success: false,
                message: "Order ID and rejection reason are required"
            });
        }

        // Find the order
        const order = await Order.findOne({ orderId: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Validate current status
        if (order.status !== 'Return Request') {
            return res.status(400).json({
                success: false,
                message: "Order is not in return request status"
            });
        }

        // Update order status back to 'Delivered' and store rejection reason
        await Order.findOneAndUpdate(
            { orderId: orderId },
            {
                status: 'Delivered',
                returnRejectionReason: reason,
                returnRejectedAt: new Date(),
                updatedAt: new Date()
            }
        );

        res.json({
            success: true,
            message: "Return request rejected successfully. Order status updated back to 'Delivered'."
        });

    } catch (error) {
        console.error("Error rejecting return request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while rejecting return request"
        });
    }
};

module.exports = {
    getOrderPage,
    updateOrderStatus,
    getOrderDetails,
    getReturnRequestsPage,
    approveReturnRequest,
    rejectReturnRequest
}