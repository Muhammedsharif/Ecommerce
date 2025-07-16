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

        // Only include completed sales (Delivered orders with Completed payment)
        const salesFilter = {
            ...dateFilter,
            status: 'Delivered',
            paymentStatus: 'Completed'
        };

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(salesFilter);

        // Calculate total pages
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders with pagination - include detailed product information
        const orders = await Order.find(salesFilter)
          .populate('userId', 'name email')
          .populate('orderedItems.product', 'productName')
          .skip(skip)
          .limit(limit)
          .sort({ createdOn: -1 });

        // Get all orders for summary calculations (without pagination)
        const allOrders = await Order.find(salesFilter)
          .populate('orderedItems.product', 'productName')
          .sort({ createdOn: -1 });

        // Calculate report metrics using all orders
        const totalSalesCount = allOrders.length;
        const totalOrderAmount = allOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = allOrders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Coupon usage summary - Fixed to use couponCode instead of couponApplied
        const couponUsage = {};
        allOrders.forEach(order => {
            if (order.couponApplied && order.couponCode) {
                const couponName = order.couponCode;
                if (!couponUsage[couponName]) {
                    couponUsage[couponName] = {
                        count: 0,
                        totalDiscount: 0
                    };
                }
                couponUsage[couponName].count++;
                couponUsage[couponName].totalDiscount += order.couponDiscount || 0;
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
            dailySales[date].discount += order.couponDiscount || 0;
        });

        // Process orders to include detailed product information
        const processedOrders = orders.map(order => {
            const orderData = order.toObject();
            
            // Calculate total quantity for the order
            const totalQuantity = orderData.orderedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            
            // Get product names
            const productNames = orderData.orderedItems.map(item => 
                item.product ? item.product.productName : 'Unknown Product'
            ).join(', ');

            return {
                ...orderData,
                totalQuantity,
                productNames,
                couponCode: orderData.couponCode || 'None',
                couponDiscount: orderData.couponDiscount || 0
            };
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
            orders: processedOrders, // Return processed orders with detailed info
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

// Download sales report as PDF - ENHANCED VERSION WITH IMPROVED DESIGN
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

        // Only include completed sales
        const salesFilter = {
            ...dateFilter,
            status: 'Delivered',
            paymentStatus: 'Completed'
        };

        const orders = await Order.find(salesFilter)
          .populate('userId', 'name email')
          .populate('orderedItems.product', 'productName')
          .sort({ createdOn: -1 });

        const totalSalesCount = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Create PDF document with enhanced layout
        const doc = new PDFDocument({ 
            margin: 40,
            size: 'A4',
            layout: 'portrait'
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="sales-report-${Date.now()}.pdf"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Define colors for better design
        const primaryColor = '#2c3e50';
        const secondaryColor = '#3498db';
        const accentColor = '#e74c3c';
        const lightGray = '#ecf0f1';
        const darkGray = '#7f8c8d';

        // ENHANCED HEADER SECTION
        doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
        doc.fontSize(28).font('Helvetica-Bold').fillColor('white')
           .text('SALES REPORT', 40, 25, { align: 'center' });
        
        // Company info (you can customize this)
        doc.fontSize(12).font('Helvetica').fillColor('white')
           .text('E-Commerce Analytics Dashboard', 40, 55, { align: 'center' });

        doc.fillColor('black'); // Reset color
        doc.y = 100; // Move below header

        // REPORT METADATA SECTION
        doc.rect(30, doc.y, doc.page.width - 70, 50).fill(lightGray).stroke();
        doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
           .text('Report Information', 50, doc.y + 10);
        
        doc.fillColor('black').fontSize(11).font('Helvetica');
        const metaY = doc.y + 30;
        doc.text(`Report Type: ${reportType.toUpperCase()}`, 50, metaY);
        doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 300, metaY);
        
        if (dateFilter.createdOn) {
            const startDateStr = dateFilter.createdOn.$gte?.toLocaleDateString() || 'N/A';
            const endDateStr = dateFilter.createdOn.$lte?.toLocaleDateString() || dateFilter.createdOn.$lt?.toLocaleDateString() || 'N/A';
            doc.text(`Period: ${startDateStr} to ${endDateStr}`, 50, metaY + 15);
        }

        doc.y += 80;

        // ENHANCED SUMMARY SECTION
        doc.fillColor(secondaryColor).fontSize(18).font('Helvetica-Bold')
           .text('EXECUTIVE SUMMARY', 40, doc.y);
        doc.moveDown(0.5);

        // Summary cards layout
        const cardWidth = 120;
        const cardHeight = 70;
        const cardSpacing = 15;
        const startX = 40;
        let currentX = startX;
        const cardY = doc.y;

        const summaryCards = [
            { label: 'Total Orders', value: totalSalesCount.toString(), color: secondaryColor },
            { label: 'Gross Revenue', value: `₹${Math.round(totalOrderAmount).toLocaleString()}`, color: '#27ae60' },
            { label: 'Total Discounts', value: `₹${Math.round(totalDiscountAmount).toLocaleString()}`, color: accentColor },
            { label: 'Net Revenue', value: `₹${Math.round(netRevenue).toLocaleString()}`, color: '#8e44ad' }
        ];

        summaryCards.forEach((card, index) => {
            // Card background
            doc.rect(currentX, cardY, cardWidth, cardHeight).fill('#ffffff').stroke('#ddd');
            
            // Card header
            doc.rect(currentX, cardY, cardWidth, 25).fill(card.color);
            doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
               .text(card.label, currentX + 5, cardY + 8, { width: cardWidth - 10, align: 'center' });
            
            // Card value
            doc.fillColor('black').fontSize(14).font('Helvetica-Bold')
               .text(card.value, currentX + 5, cardY + 35, { width: cardWidth - 10, align: 'center' });
            
            currentX += cardWidth + cardSpacing;
        });

        // Average Order Value
        const avgOrderValue = totalSalesCount > 0 ? (totalOrderAmount / totalSalesCount).toFixed(0) : '0.00';
        doc.fillColor(darkGray).fontSize(12).font('Helvetica')
           .text(`Average Order Value: ₹${avgOrderValue}`, 40, cardY + cardHeight + 20);

        doc.y = cardY + cardHeight + 50;

        // ENHANCED ORDERS TABLE
        doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
           .text(' ORDER DETAILS', 40, doc.y);
        doc.moveDown(1);

        if (orders.length > 0) {
            // Optimized table layout for A4 (595 points width, minus 80 for margins = 515 points)
            const tableHeaders = ['Order ID', 'Customer', 'Products', 'Qty', 'Amount', 'Discount', 'Date'];
            const columnWidths = [60, 85, 180, 35, 60, 50, 55]; // Total: 535 points
            const tableStartX = 40;
            const rowHeight = 18;
            
            // Table header background
            const headerY = doc.y;
            doc.rect(tableStartX, headerY, 515, 25).fill(primaryColor);
            
            // Table headers
            doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
            let xPos = tableStartX;
            tableHeaders.forEach((header, index) => {
                doc.text(header, xPos + 3, headerY + 8, { 
                    width: columnWidths[index] - 6, 
                    align: 'center'
                });
                xPos += columnWidths[index];
            });

            doc.y = headerY + 30;
            let rowIndex = 0;

            // Table rows with alternating colors
            orders.slice(0, 50).forEach((order) => {
                // Check for page break
                if (doc.y > 750) {
                    doc.addPage();
                    doc.y = 50;
                    
                    // Redraw header on new page
                    const newHeaderY = doc.y;
                    doc.rect(tableStartX, newHeaderY, 515, 25).fill(primaryColor);
                    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
                    xPos = tableStartX;
                    tableHeaders.forEach((header, index) => {
                        doc.text(header, xPos + 3, newHeaderY + 8, { 
                            width: columnWidths[index] - 6, 
                            align: 'center'
                        });
                        xPos += columnWidths[index];
                    });
                    doc.y = newHeaderY + 30;
                    rowIndex = 0;
                }

                const rowY = doc.y;
                
                // Alternating row colors
                const rowColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
                doc.rect(tableStartX, rowY, 515, rowHeight).fill(rowColor).stroke('#ddd');

                // Prepare data with smart truncation
                const productNames = order.orderedItems.map(item => item.product?.productName || 'Unknown').join(', ');
                const truncatedProducts = productNames.length > 35 ? productNames.substring(0, 32) + '...' : productNames;
                const customerName = (order.userId?.name || 'N/A').length > 15 ? (order.userId?.name || 'N/A').substring(0, 12) + '...' : (order.userId?.name || 'N/A');
                
                const rowData = [
                    order.orderId || order._id.toString().slice(-8),
                    customerName,
                    truncatedProducts,
                    order.orderedItems.reduce((sum, item) => sum + (item.quantity || 0), 0).toString(),
                    `₹${Math.round((order.totalPrice || 0)).toLocaleString()}`,
                    `₹${Math.round((order.couponDiscount || 0)).toLocaleString()}`,
                    order.createdOn?.toLocaleDateString() || 'N/A'
                ];

                // Draw row data
                doc.fillColor('black').fontSize(9).font('Helvetica');
                xPos = tableStartX;
                rowData.forEach((data, colIndex) => {
                    const textAlign = colIndex >= 3 && colIndex <= 5 ? 'center' : 'left'; // Center align numbers
                    doc.text(data, xPos + 3, rowY + 5, { 
                        width: columnWidths[colIndex] - 6,
                        align: textAlign,
                        lineBreak: false,
                        ellipsis: true
                    });
                    xPos += columnWidths[colIndex];
                });

                doc.y += rowHeight;
                rowIndex++;
            });

            // Show limitation notice if there are more orders
            if (orders.length > 50) {
                doc.moveDown(1);
                doc.fillColor(darkGray).fontSize(10).font('Helvetica-Oblique')
                   .text(`Note: Showing first 50 orders out of ${orders.length} total orders.`, 40);
            }

        } else {
            doc.fillColor(darkGray).fontSize(14).font('Helvetica')
               .text('📭 No orders found for the selected period.', 40, doc.y, { align: 'center' });
        }

        // FOOTER
        const footerY = doc.page.height - 60;
        doc.rect(0, footerY, doc.page.width, 60).fill(lightGray);
        doc.fillColor(darkGray).fontSize(10).font('Helvetica')
           .text('Generated by E-Commerce Analytics System', 40, footerY + 20)
           .text(`Report ID: RPT-${Date.now()}`, 40, footerY + 35)
           .text(`Page 1 of 1 | Confidential Document`, doc.page.width - 200, footerY + 20, { align: 'right' });

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

        // Only include completed sales
        const salesFilter = {
            ...dateFilter,
            status: 'Delivered',
            paymentStatus: 'Completed'
        };

        const orders = await Order.find(salesFilter)
          .populate('userId', 'name email')
          .populate('orderedItems.product', 'productName')
          .sort({ createdOn: -1 });

        const totalSalesCount = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
        const totalDiscountAmount = orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
        const netRevenue = totalOrderAmount - totalDiscountAmount;

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();

        // Summary worksheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        // Add title and styling
        summarySheet.addRow(['Sales Report Summary']);
        summarySheet.getRow(1).font = { bold: true, size: 16 };
        summarySheet.addRow([]);
        
        summarySheet.addRow(['Report Type', reportType.toUpperCase()]);
        summarySheet.addRow(['Generated On', new Date().toLocaleDateString()]);
        if (dateFilter.createdOn) {
            const startDate = dateFilter.createdOn.$gte?.toLocaleDateString() || 'N/A';
            const endDate = dateFilter.createdOn.$lte?.toLocaleDateString() || dateFilter.createdOn.$lt?.toLocaleDateString() || 'N/A';
            summarySheet.addRow(['Date Range', `${startDate} - ${endDate}`]);
        }
        summarySheet.addRow([]);
        
        // Summary metrics
        summarySheet.addRow(['Metric', 'Value']);
        summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
        summarySheet.addRow(['Total Sales Count', totalSalesCount]);
        summarySheet.addRow(['Total Order Amount', `₹${totalOrderAmount.toFixed(2)}`]);
        summarySheet.addRow(['Total Discount Amount', `₹${totalDiscountAmount.toFixed(2)}`]);
        summarySheet.addRow(['Net Revenue', `₹${netRevenue.toFixed(2)}`]);
        summarySheet.addRow(['Average Order Value', `₹${totalSalesCount > 0 ? (totalOrderAmount / totalSalesCount).toFixed(2) : '0.00'}`]);

        // Auto-fit columns
        summarySheet.columns = [
            { width: 25 },
            { width: 20 }
        ];

        // Orders worksheet with detailed information
        const ordersSheet = workbook.addWorksheet('Orders');
        
        // Add headers
        const headers = [
            'Order ID', 'Customer Name', 'Customer Email', 'Product Names', 
            'Total Quantity', 'Order Amount', 'Coupon Code', 'Discount Applied', 
            'Net Amount', 'Payment Method', 'Order Date', 'Status'
        ];
        
        ordersSheet.addRow(headers);
        ordersSheet.getRow(1).font = { bold: true };

        // Add order data
        orders.forEach(order => {
            const productNames = order.orderedItems.map(item => 
                item.product?.productName || 'Unknown Product'
            ).join(', ');
            
            const totalQuantity = order.orderedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

            ordersSheet.addRow([
                order.orderId || order._id.toString().slice(-6),
                order.userId?.name || 'N/A',
                order.userId?.email || 'N/A',
                productNames,
                totalQuantity,
                order.totalPrice || 0,
                order.couponCode || 'None',
                order.couponDiscount || 0,
                (order.totalPrice || 0) - (order.couponDiscount || 0),
                order.paymentMethod || 'N/A',
                order.createdOn?.toLocaleDateString() || 'N/A',
                order.status || 'N/A'
            ]);
        });

        // Auto-fit columns
        ordersSheet.columns = [
            { width: 15 }, // Order ID
            { width: 20 }, // Customer Name
            { width: 25 }, // Customer Email
            { width: 40 }, // Product Names
            { width: 12 }, // Total Quantity
            { width: 15 }, // Order Amount
            { width: 15 }, // Coupon Code
            { width: 15 }, // Discount Applied
            { width: 15 }, // Net Amount
            { width: 15 }, // Payment Method
            { width: 15 }, // Order Date
            { width: 12 }  // Status
        ];

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