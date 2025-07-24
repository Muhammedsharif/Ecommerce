// User wallet management routes
const express = require("express");
const router = express.Router();
const profileController = require("../../controllers/user/profileController");
const { userAuth } = require("../../middlewares/auth");

// Wallet Management
router.get("/", userAuth, profileController.loadWallet);

module.exports = router;