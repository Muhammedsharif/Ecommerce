// User order management routes
const express = require("express");
const router = express.Router();
const profileController = require("../../controllers/user/profileController");
const orderUtilsController = require("../../controllers/user/orderUtilsController");
const { userAuth } = require("../../middlewares/auth");

// Order Management Routes
router.get("/", userAuth, profileController.loadOrders);
router.get("/details/:orderId", userAuth, profileController.loadOrderDetails);
router.post("/cancel", userAuth, profileController.cancelOrder);
router.post("/cancel-item", userAuth, profileController.cancelItem);
router.post("/cancel-all-items", userAuth, profileController.cancelAllItems);
router.post("/return", userAuth, profileController.returnOrder);
router.post("/return-item", userAuth, profileController.returnItem);
router.post("/return-all-items", userAuth, profileController.returnAllItems);
router.get("/download-invoice/:orderId", userAuth, profileController.downloadInvoice);
router.get("/get-updated-totals/:orderId", userAuth, orderUtilsController.getUpdatedTotals);

module.exports = router;