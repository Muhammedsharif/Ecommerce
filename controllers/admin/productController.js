const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("productAdd", {
      cat: category,
    });
  } catch (error) {
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
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      const image = [];

      if (req.files && req.files.length > 0) {
        if (req.files.length !== 3) {
             return res.status(400).json({ error: "select 3 images" });
        }
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          const originalExtension = path
            .extname(req.files[i].originalname)
            .toLowerCase();
          const isPng = originalExtension === ".png";
          // Generate a unique filename using timestamp or UUID
          const uniqueFilename = `${Date.now()}-${Math.floor(
            Math.random() * 1000
          )}${path.extname(req.files[i].originalname)}`;
          const relativePath = path.join(
            "uploads",
            "product-images",
            uniqueFilename
          );
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
        }
      }

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json({ error: "Invalid category name" });
      }

      // 🟡 Handle selected sizes
      
      let selectedSizes = req.body.sizes;
      if (!selectedSizes) {
        selectedSizes = [];
      } else if (!Array.isArray(selectedSizes)) {
        selectedSizes = [selectedSizes];
      }
      

      // Create variant array
      const variantData = selectedSizes.map((size) => ({
        size,
        varientPrice: products.regularPrice,
        salePrice: products.salePrice,
        varientquantity: products.quantity,
      }));
   
      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),
        quantity: products.quantity,
        color: products.color,
        productImage: image,
        variant: variantData, // ✅ stored as array
        status: "Available",
      });

      await newProduct.save();
      return res
        .status(200)
        .json({
          success: true,
          message: "Product has been added successfully",
        });
    } else {
      return res
        .status(400)
        .json({
          error: "Product already exists, please try with another name",
        });
    }
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageerror");
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
    const category = await Category.find({});

    res.render("editProduct", {
      product: product,
      cat: category,
    });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ _id: id });
    const data = req.body;

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id },
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

    // Find category ID
    const categoryId = await Category.findOne({ name: data.category });
    if (!categoryId) {
      return res.status(400).json({ error: "Invalid category name" });
    }

    let selectedSizes = req.body.sizes;
    if (!selectedSizes) {
      selectedSizes = [];
    } else if (!Array.isArray(selectedSizes)) {
      selectedSizes = [selectedSizes];
    }
    console.log("Selected sizes:", selectedSizes);

    // Create variant array
    const variantData = selectedSizes.map((size) => ({
      size,
      varientPrice: product.regularPrice,
      salePrice: product.salePrice,
      varientquantity: product.quantity,
    }));

    const updateFields = {
      productName: data.productName,
      description: data.description,
      category: categoryId._id,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      quantity: data.quantity,
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
