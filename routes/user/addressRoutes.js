// User address management routes
const express = require("express");
const router = express.Router();
const profileController = require("../../controllers/user/profileController");
const { userAuth } = require("../../middlewares/auth");

// Address Management
router.get("/", userAuth, profileController.loadAddress);
router.get("/add", userAuth, profileController.loadAddAddress);
router.post("/add", userAuth, profileController.addAddress);
router.post("/set-default", userAuth, profileController.setDefaultAddress);
router.get("/edit", userAuth, profileController.loadeditAddress);
router.post("/edit", userAuth, profileController.editAddress);
router.get("/delete", userAuth, profileController.deleteAddress);

module.exports = router;