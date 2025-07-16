const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Get sales report dashboard
const getSalesReportDashboard = async (req, res) => {
    try {
        
        res.render("admin-sales-report", {
            title: "Sales Report Dashboard"
        });
    } catch (error) {
        console.error("Error loading sales report dashboard:", error);
        res.redirect("/admin/pageerror");
    }
};

// Generate sales report data
const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate, customDays } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Calculate date range based on report type
        let dateFilter = {};
        const now = new Date();
        
        switch (reportType) {
            case 'daily':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateFilter = {
                    createdOn: {
                        $gte: today,
                        $lt: tomorrow
                    }
                };
                break;
                
            case 'weekly':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - 7);
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: weekStart,
                        $lte: now
                    }
                };
                break;
                
            case 'monthly':
                const monthStart = new Date();
                monthStart.setDate(monthStart.getDate() - 30);
                monthStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: monthStart,
                        $lte: now
                    }
                };
                break;
                
            case 'yearly':
                const yearStart = new Date();
                yearStart.setFullYear(yearStart.getFullYear() - 1);
                yearStart.setHours(0, 0, 0, 0);
                dateFilter = {
                    createdOn: {
                        $gte: yearStart,
                        $lte: now
                    }
                };
                break;
                
            case 'custom':
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    dateFilter = {
                        createdOn: {
                            $gte: start,
                            $lte: end
                        }
                    };
                }
                break;
                
            case 'customDays':
                if (customDays) {
                    const daysStart = new Date();
                    daysStart.setDate(daysStart.getDate() - parseInt(customDays));
                    daysStart.setHours(0, 0, 0, 0);
                    dateFilter = {
                        createdOn: {
                            $gte: daysStart,
                            $lte: now
                        }
                    };
                }
                break;
        }

        // Get total count for pagination
        const totalOrders = await Order.countDocuments({
            ...dateFilter,
            status: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders with pagination
        const orders = await Order.find({
            ...dateFilter,
            status: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
        }).populate('userId', 'name email')
          .populate('orderedItems.product', 'productName')
          .populate('couponApplied', 'name offerPrice discountType')
          .skip(skip)
          .limit(limit)
          .sort({ createdOn: -1 });

        // Get all orders for summary calculations (without pagination)
        const allOrders = await Order.find({
            ...dateFilter,
            status: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
        }).populate('couponApplied', 'name offerPrice discountType')
          .sort({ createdOn: -1 });

        // Calculate report metrics using all orders
        const totalSalesCount = allOrders.length;
        const totalOrderAmount = allOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = allOrders.reduce((sum, order) => sum + (order.discount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Coupon usage summary
        const couponUsage = {};
        allOrders.forEach(order => {
            if (order.couponApplied) {
                const couponName = order.couponApplied.name;
                if (!couponUsage[couponName]) {
                    couponUsage[couponName] = {
                        count: 0,
                        totalDiscount: 0,
                        discountType: order.couponApplied.discountType
                    };
                }
                couponUsage[couponName].count++;
                couponUsage[couponName].totalDiscount += order.discount || 0;
            }
        });

        // Daily sales breakdown for charts
        const dailySales = {};
        allOrders.forEach(order => {
            const date = order.createdOn.toISOString().split('T')[0];
            if (!dailySales[date]) {
                dailySales[date] = {
                    count: 0,
                    amount: 0,
                    discount: 0
                };
            }
            dailySales[date].count++;
            dailySales[date].amount += order.totalPrice || 0;
            dailySales[date].discount += order.discount || 0;
        });

        const reportData = {
            reportType,
            dateRange: {
                start: dateFilter.createdOn?.$gte || null,
                end: dateFilter.createdOn?.$lte || dateFilter.createdOn?.$lt || null
            },
            summary: {
                totalSalesCount,
                totalOrderAmount,
                totalDiscountAmount,
                netRevenue,
                averageOrderValue: totalSalesCount > 0 ? totalOrderAmount / totalSalesCount : 0
            },
            couponUsage: Object.entries(couponUsage).map(([name, data]) => ({
                couponName: name,
                ...data
            })),
            dailySales: Object.entries(dailySales).map(([date, data]) => ({
                date,
                ...data
            })).sort((a, b) => new Date(a.date) - new Date(b.date)),
            orders: orders, // Return paginated orders
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalOrders: totalOrders,
                limit: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };

        res.json({
            success: true,
            data: reportData
        });

    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate sales report"
        });
    }
};

// Download sales report as PDF
const downloadPDFReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate, customDays } = req.query;

        // Recreate the report data generation logic
        let dateFilter = {};
        const now = new Date();

        switch (reportType) {
            case 'daily':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateFilter = { createdOn: { $gte: today, $lt: tomorrow } };
                break;
            case 'weekly':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - 7);
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: weekStart, $lte: now } };
                break;
            case 'monthly':
                const monthStart = new Date();
                monthStart.setDate(monthStart.getDate() - 30);
                monthStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: monthStart, $lte: now } };
                break;
            case 'yearly':
                const yearStart = new Date();
                yearStart.setFullYear(yearStart.getFullYear() - 1);
                yearStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: yearStart, $lte: now } };
                break;
            case 'custom':
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    dateFilter = { createdOn: { $gte: start, $lte: end } };
                }
                break;
            case 'customDays':
                if (customDays) {
                    const daysStart = new Date();
                    daysStart.setDate(daysStart.getDate() - parseInt(customDays));
                    daysStart.setHours(0, 0, 0, 0);
                    dateFilter = { createdOn: { $gte: daysStart, $lte: now } };
                }
                break;
        }

        const orders = await Order.find({
            ...dateFilter,
            status: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
        }).populate('userId', 'name email')
          .populate('couponApplied', 'name offerPrice discountType');

        const totalSalesCount = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="sales-report-${Date.now()}.pdf"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Add report details
        doc.fontSize(12);
        doc.text(`Report Type: ${reportType.toUpperCase()}`);
        doc.text(`Generated On: ${new Date().toLocaleDateString()}`);
        if (dateFilter.createdOn) {
            doc.text(`Date Range: ${dateFilter.createdOn.$gte?.toLocaleDateString()} - ${dateFilter.createdOn.$lte?.toLocaleDateString() || dateFilter.createdOn.$lt?.toLocaleDateString()}`);
        }
        doc.moveDown();

        // Add summary section
        doc.fontSize(16).text('Summary', { underline: true });
        doc.fontSize(12);
        doc.text(`Total Sales Count: ${totalSalesCount}`);
        doc.text(`Total Order Amount: ₹${totalOrderAmount.toFixed(2)}`);
        doc.text(`Total Discount Amount: ₹${totalDiscountAmount.toFixed(2)}`);
        doc.text(`Net Revenue: ₹${netRevenue.toFixed(2)}`);
        doc.text(`Average Order Value: ₹${totalSalesCount > 0 ? (totalOrderAmount / totalSalesCount).toFixed(2) : '0.00'}`);
        doc.moveDown();

        // Add orders table
        if (orders.length > 0) {
            doc.fontSize(16).text('Order Details', { underline: true });
            doc.fontSize(10);

            let yPosition = doc.y + 10;
            const pageHeight = doc.page.height - 100;

            orders.slice(0, 50).forEach((order, index) => {
                if (yPosition > pageHeight) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`${index + 1}. Order #${order.orderId || order._id.toString().slice(-6)}`, 50, yPosition);
                doc.text(`Customer: ${order.userId?.name || 'N/A'}`, 200, yPosition);
                doc.text(`Amount: ₹${order.totalPrice?.toFixed(2) || '0.00'}`, 350, yPosition);
                doc.text(`Date: ${order.createdOn?.toLocaleDateString() || 'N/A'}`, 450, yPosition);

                yPosition += 15;
            });
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error("Error generating PDF report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate PDF report"
        });
    }
};

// Download sales report as Excel
const downloadExcelReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate, customDays } = req.query;

        // Recreate the report data generation logic (same as PDF)
        let dateFilter = {};
        const now = new Date();

        switch (reportType) {
            case 'daily':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateFilter = { createdOn: { $gte: today, $lt: tomorrow } };
                break;
            case 'weekly':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - 7);
                weekStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: weekStart, $lte: now } };
                break;
            case 'monthly':
                const monthStart = new Date();
                monthStart.setDate(monthStart.getDate() - 30);
                monthStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: monthStart, $lte: now } };
                break;
            case 'yearly':
                const yearStart = new Date();
                yearStart.setFullYear(yearStart.getFullYear() - 1);
                yearStart.setHours(0, 0, 0, 0);
                dateFilter = { createdOn: { $gte: yearStart, $lte: now } };
                break;
            case 'custom':
                if (startDate && endDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    dateFilter = { createdOn: { $gte: start, $lte: end } };
                }
                break;
            case 'customDays':
                if (customDays) {
                    const daysStart = new Date();
                    daysStart.setDate(daysStart.getDate() - parseInt(customDays));
                    daysStart.setHours(0, 0, 0, 0);
                    dateFilter = { createdOn: { $gte: daysStart, $lte: now } };
                }
                break;
        }

        const orders = await Order.find({
            ...dateFilter,
            status: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
        }).populate('userId', 'name email')
          .populate('couponApplied', 'name offerPrice discountType');

        const totalSalesCount = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();

        // Summary worksheet
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.addRow(['Sales Report Summary']);
        summarySheet.addRow(['Report Type', reportType.toUpperCase()]);
        summarySheet.addRow(['Generated On', new Date().toLocaleDateString()]);
        if (dateFilter.createdOn) {
            summarySheet.addRow(['Date Range', `${dateFilter.createdOn.$gte?.toLocaleDateString()} - ${dateFilter.createdOn.$lte?.toLocaleDateString() || dateFilter.createdOn.$lt?.toLocaleDateString()}`]);
        }
        summarySheet.addRow([]);
        summarySheet.addRow(['Metric', 'Value']);
        summarySheet.addRow(['Total Sales Count', totalSalesCount]);
        summarySheet.addRow(['Total Order Amount', `₹${totalOrderAmount.toFixed(2)}`]);
        summarySheet.addRow(['Total Discount Amount', `₹${totalDiscountAmount.toFixed(2)}`]);
        summarySheet.addRow(['Net Revenue', `₹${netRevenue.toFixed(2)}`]);
        summarySheet.addRow(['Average Order Value', `₹${totalSalesCount > 0 ? (totalOrderAmount / totalSalesCount).toFixed(2) : '0.00'}`]);

        // Orders worksheet
        const ordersSheet = workbook.addWorksheet('Orders');
        ordersSheet.addRow(['Order ID', 'Customer Name', 'Customer Email', 'Order Amount', 'Discount', 'Net Amount', 'Coupon Used', 'Order Date', 'Status']);

        orders.forEach(order => {
            ordersSheet.addRow([
                order.orderId || order._id.toString().slice(-6),
                order.userId?.name || 'N/A',
                order.userId?.email || 'N/A',
                order.totalPrice || 0,
                order.discount || 0,
                (order.totalPrice || 0) - (order.discount || 0),
                order.couponApplied?.name || 'None',
                order.createdOn?.toLocaleDateString() || 'N/A',
                order.status || 'N/A'
            ]);
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="sales-report-${Date.now()}.xlsx"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error generating Excel report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate Excel report"
        });
    }
};

module.exports = {
    getSalesReportDashboard,
    generateSalesReport,
    downloadPDFReport,
    downloadExcelReport
};
