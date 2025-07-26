// Import required models and modules for product management
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs"); // File system operations
const path = require("path"); // Path manipulation utilities
const sharp = require("sharp"); // Image processing library

// Controller function to render the add product page with categories
const getProductAddPage = async (req, res) => {
  try {
    // Fetch active categories for the form dropdown
    const category = await Category.find({ isListed: true });
    res.render("productAdd", {
      cat: category,
    });
  } catch (error) {
    // Redirect to error page if database operations fail
    res.redirect("/pageerror");
  }
};

const getAllProducts = async (req, res) => {
  try {
    let search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    // Define the query for both data and count
    const query = {
      isDeleted: false,
      $or: [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
      ],
    };

    // Fetch products with pagination
    const productData = await Product.find(query)
      .limit(limit)
      .sort({ createdAt:-1 })
      .skip((page - 1) * limit)
      .populate("category")
      .exec()


    // Count total matching documents
    const count = await Product.countDocuments(query);

    // Calculate total pages
    const totalPages = Math.ceil(count / limit);

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: totalPages,
        cat: category,
        search,
      });
    } else {
      res.render("page-404");
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.redirect("/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    console.log("Received product data:", products);

    // Basic validation
    if (!products.productName || !products.productName.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }

    if (!products.description || !products.description.trim()) {
      return res.status(400).json({ error: "Product description is required" });
    }

    if (!products.category) {
      return res.status(400).json({ error: "Category is required" });
    }

    if (!products.color || !products.color.trim()) {
      return res.status(400).json({ error: "Color is required" });
    }

    // Enhanced duplicate check: case-insensitive and exclude deleted products
    const productExists = await Product.findOne({
      productName: { $regex: new RegExp(`^${products.productName.trim()}$`, 'i') },
      isDeleted: false
    });

    if (productExists) {
      return res.status(400).json({
        error: "Product already exists, please try with another name",
      });
    }

    const image = [];

    // Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please select 3 images" });
    }

    if (req.files.length !== 3) {
      return res.status(400).json({ error: "Please select exactly 3 images" });
    }

    // Process images
    for (let i = 0; i < req.files.length; i++) {
      try {
        const originalImagePath = req.files[i].path;
        const originalExtension = path
          .extname(req.files[i].originalname)
          .toLowerCase();
        const isPng = originalExtension === ".png";
        
        // Generate a unique filename using timestamp or UUID
        const uniqueFilename = `${Date.now()}-${Math.floor(
          Math.random() * 1000
        )}${path.extname(req.files[i].originalname)}`;
        
        const resizedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          uniqueFilename.replace(/\.[^/.]+$/, ".jpg")
        );

        const sharpInstance = sharp(originalImagePath)
          .resize({ width: 440, height: 440, fit: "cover" })
          .flatten({ background: "#ffffff" }); // Force white background
          
        if (isPng) {
          // Output as PNG to preserve transparency handling
          await sharpInstance.png({ quality: 90 }).toFile(resizedImagePath);
        } else {
          // Output as JPEG for other formats
          await sharpInstance.jpeg({ quality: 90 }).toFile(resizedImagePath);
        }

        image.push(uniqueFilename.replace(/\.[^/.]+$/, ".jpg"));
      } catch (imageError) {
        console.error("Error processing image:", imageError);
        return res.status(400).json({ error: "Error processing images. Please try again." });
      }
    }

    // Validate category
    const categoryId = await Category.findById(products.category);
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category selected" });
    }

    // Handle selected sizes
    let selectedSizes = req.body.sizes;
    if (!selectedSizes) {
      return res.status(400).json({ error: "Please select at least one size" });
    }
    
    if (!Array.isArray(selectedSizes)) {
      selectedSizes = [selectedSizes];
    }

    // Handle tags
    let tags = [];
    if (products.tags && products.tags.trim() !== '') {
      tags = products.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    }

    // Parse size variants data from form
    let sizeVariants = {};
    try {
      if (products.sizeVariants) {
        sizeVariants = JSON.parse(products.sizeVariants);
      }
    } catch (error) {
      console.error("Error parsing size variants:", error);
      return res.status(400).json({ error: "Invalid size variant data" });
    }

    // Validate size variants
    for (const size of selectedSizes) {
      if (!sizeVariants[size] || !sizeVariants[size].price || !sizeVariants[size].quantity) {
        return res.status(400).json({ error: `Please provide price and quantity for size ${size}` });
      }
      
      const price = parseFloat(sizeVariants[size].price);
      const quantity = parseInt(sizeVariants[size].quantity);
      
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: `Invalid price for size ${size}` });
      }
      
      if (isNaN(quantity) || quantity < 0) {
        return res.status(400).json({ error: `Invalid quantity for size ${size}` });
      }
    }

    // Calculate regular price as the average of all variant prices
    let varientPrice = 0;
    if (selectedSizes.length > 0) {
      const totalPrice = selectedSizes.reduce((sum, size) => {
        return sum + (parseFloat(sizeVariants[size]?.price) || 0);
      }, 0);
      varientPrice = totalPrice / selectedSizes.length;
    }

    // Calculate sale price based on product offer using the calculated regular price
    let salePrice = varientPrice;
    if (products.productOffer && products.productOffer > 0) {
      const discountAmount = Math.round((varientPrice * products.productOffer) / 100);
      salePrice = Math.round(varientPrice - discountAmount);
    }

    // Create variant array with quantities from size variants
    const variantData = selectedSizes.map((size) => {
      const variantPrice = parseFloat(sizeVariants[size]?.price) || varientPrice;
      let variantSalePrice = variantPrice;
      if (products.productOffer && products.productOffer > 0) {
        const discountAmount = Math.round((variantPrice * products.productOffer) / 100);
        variantSalePrice = Math.round(variantPrice - discountAmount);
      }
      return {
        size,
        varientPrice: variantPrice,
        salePrice: variantSalePrice,
        varientquantity: parseInt(sizeVariants[size]?.quantity) || 0,
      };
    });

    const newProduct = new Product({
      productName: products.productName.trim(),
      description: products.description.trim(),
      category: categoryId._id,
      salePrice: salePrice,
      varientPrice: varientPrice,
      productOffer: products.productOffer || 0,
      createdOn: new Date(),
      quantity: 0, // Default quantity, managed through variants
      color: products.color.trim(),
      productImage: image,
      variant: variantData,
      tags: tags,
      status: products.status || "Available",
    });

    await newProduct.save();
    return res.status(200).json({
      success: true,
      message: "Product has been added successfully",
      createdOn: newProduct.createdOn
    });

  } catch (error) {
    console.error("Error saving product:", error);
    
    // Handle specific mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: `Validation error: ${validationErrors.join(', ')}`
      });
    }
    
    // Handle mongoose duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Product with this name already exists"
      });
    }
    
    return res.status(500).json({
      error: "An error occurred while saving the product. Please try again."
    });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const deleteProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    
    const result = await Product.findByIdAndUpdate(productId, {
      isDeleted: true,
    });

    if (result) {
      res.json({ success: true, message: "Product soft deleted" });
    } else {
      res.json({ success: false, message: "Product not found" });
    }
  } catch (err) {
    console.error("Error soft deleting product:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;

    const product = await Product.findOne({ _id: id });
    console.log('Product found:', product ? 'Yes' : 'No');

    // Debug logging for variant data
    if (product && product.variant) {
      console.log('🔍 CONTROLLER DEBUG: Product variant data:');
      console.log('🔍 CONTROLLER DEBUG: Variant array length:', product.variant.length);
      product.variant.forEach((variant, index) => {
        console.log(`🔍 CONTROLLER DEBUG: Variant ${index}:`, {
          size: variant.size,
          varientPrice: variant.varientPrice,
          varientquantity: variant.varientquantity,
          salePrice: variant.salePrice
        });
      });
    } else {
      console.log('🔍 CONTROLLER DEBUG: No variant data found');
    }

    const category = await Category.find({ isListed: true });

    res.render("editProduct", {
      product: product,
      cat: category,
    });
  } catch (error) {
    console.error('Error in getEditProduct:', error);
    res.redirect("/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;

    // Enhanced duplicate check for edit: case-insensitive, exclude current product and deleted products
    const existingProduct = await Product.findOne({
      productName: { $regex: new RegExp(`^${data.productName.trim()}$`, 'i') },
      _id: { $ne: id },
      isDeleted: false
    });

    if (existingProduct) {
      return res
        .status(400)
        .json({
          error:
            "Product with this name already exists. Please try with another name",
        });
    }

    const images = [];

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
        const originalExtension = path
          .extname(req.files[i].originalname)
          .toLowerCase();
        const isPng = originalExtension === ".png";
        // Generate a unique filename
        const uniqueFilename = `${Date.now()}-${Math.floor(
          Math.random() * 1000
        )}${path.extname(req.files[i].originalname)}`;
        const resizedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          uniqueFilename.replace(/\.[^/.]+$/, ".jpg")
        );

        const sharpInstance = sharp(originalImagePath)
          .resize({ width: 440, height: 440, fit: "cover" })
          .flatten({ background: "#ffffff" }); // Force white background
        if (isPng) {   
          await sharpInstance.png({ quality: 90 }).toFile(resizedImagePath);
        } else {
          await sharpInstance.jpeg({ quality: 90 }).toFile(resizedImagePath);
        }

        images.push(uniqueFilename.replace(/\.[^/.]+$/, ".jpg"));
      }
    }

    // Validate total image count (existing + new) equals 3
    const currentImageCount = product.productImage ? product.productImage.length : 0;
    const newImageCount = images.length;
    const totalImageCount = currentImageCount + newImageCount;

    if (totalImageCount !== 3) {
      return res.status(400).json({ 
        error: `Total images must be exactly 3. Currently you have ${currentImageCount} existing images and are uploading ${newImageCount} new images (total: ${totalImageCount}).` 
      });
    }

    // Find category by ID (form sends category ID, not name)
    const categoryId = await Category.findOne({ _id: data.category });
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category selected" });
    }

    let selectedSizes = req.body.sizes;
    if (!selectedSizes) {
      selectedSizes = [];
    } else if (!Array.isArray(selectedSizes)) {
      selectedSizes = [selectedSizes];
    }
    console.log("Selected sizes:", selectedSizes);

    // Parse size variants data from form
    let sizeVariants = {};
    try {
      if (data.sizeVariants) {
        sizeVariants = JSON.parse(data.sizeVariants);
        console.log("Parsed size variants:", sizeVariants);
      }
    } catch (error) {
      console.error("Error parsing size variants:", error);
    }

    // Calculate regular price as the average of all variant prices
    let varientPrice = 0;
    if (selectedSizes.length > 0) {
      const totalPrice = selectedSizes.reduce((sum, size) => {
        return sum + (parseFloat(sizeVariants[size]?.price) || 0);
      }, 0);
      varientPrice = totalPrice / selectedSizes.length;
    }

    // Calculate sale price based on product offer using the calculated regular price
    let salePrice = varientPrice;
    if (data.productOffer && data.productOffer > 0) {
      const discountAmount = Math.round((varientPrice * data.productOffer) / 100);
      salePrice = Math.round(varientPrice - discountAmount);
    }

    // Create variant array with data from form or defaults
    const variantData = selectedSizes.map((size) => {
      const variantPrice = parseFloat(sizeVariants[size]?.price) || varientPrice;
      let variantSalePrice = variantPrice;
      if (data.productOffer && data.productOffer > 0) {
        const discountAmount = Math.round((variantPrice * data.productOffer) / 100);
        variantSalePrice = Math.round(variantPrice - discountAmount);
      }
      return {
        size,
        varientPrice: variantPrice,
        salePrice: variantSalePrice,
        varientquantity: parseInt(sizeVariants[size]?.quantity) || 0,
      };
    });

    const updateFields = {
      productName: data.productName,
      description: data.description,
      category: categoryId._id,
      salePrice: salePrice,
      varientPrice: varientPrice,
      productOffer: data.productOffer || 0,
      quantity: 0, // Default quantity, managed through variants
      color: data.color,
      variant: variantData,
    };

    if (images.length > 0) {
      updateFields.$push = { productImage: { $each: images } };
    }

    await Product.findByIdAndUpdate(id, updateFields, { new: true });

    // Send JSON response for AJAX call
    res
      .status(200)
      .json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    console.log(
      "Image name:",
      imageNameToServer,
      "Product ID:",
      productIdToServer
    );

    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });

    const imagePath = path.join(
      "public",
      "uploads",
      "product-images",
      imageNameToServer
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to delete image" });
  }
};

module.exports = {
  getProductAddPage,
  getAllProducts,
  addProducts,
  deleteProduct,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
};