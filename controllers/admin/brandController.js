const Brand = require("../../models/brandSchema");

const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brands", {
            data: brandData,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error("Error fetching brands:", error);
        res.redirect("/pageerror");
    }
};

const addBrand = async (req, res) => {
    try {
        const { brandName } = req.body;

        const existingBrand = await Brand.findOne({ brandName });
        if (existingBrand) {
            return res.status(400).json({ error: "Brand already exists" });
        }

        const newBrand = new Brand({
            brandName: brandName,
            brandImage: req.file ? [req.file.filename] : []
        });

        await newBrand.save();
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error adding brand:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const blockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error blocking brand:", error);
        res.redirect("/pageerror");
    }
};

const unblockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error unblocking brand:", error);
        res.redirect("/pageerror");
    }
};

module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand
};
