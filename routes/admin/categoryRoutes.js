// Admin category management routes
const express = require('express');
const router = express.Router();
const categoryController = require("../../controllers/admin/categoryController");
const { adminAuth } = require('../../middlewares/auth');

// Category Management
router.get("/", adminAuth, categoryController.categoryInfo);
router.post("/add", adminAuth, categoryController.addCategory);
router.get("/list", adminAuth, categoryController.getListCategory);
router.get("/unlist", adminAuth, categoryController.getUnlistCategory);
router.get("/edit", adminAuth, categoryController.geteditCategory);
router.patch("/edit/:id", adminAuth, categoryController.editCategory);
router.patch("/delete", adminAuth, categoryController.deleteCategory);
router.post("/offer", adminAuth, categoryController.addCategoryOffer);
router.delete("/offer", adminAuth, categoryController.removeCategoryOffer);

module.exports = router;