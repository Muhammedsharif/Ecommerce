// Admin banner management routes
const express = require('express');
const router = express.Router();
const bannerController = require("../../controllers/admin/bannerController");
const { adminAuth } = require('../../middlewares/auth');
const multer = require("multer");
const storage = require("../../helpers/multer");
const uploads = multer({storage: storage});

// Banner Management
router.get("/", adminAuth, bannerController.getBannerPage);
router.get("/add", adminAuth, bannerController.getAddBannerPage);
router.post("/add", adminAuth, uploads.single("images"), bannerController.addBanner);

module.exports = router;