const Category = require("../../models/categorySchema");  


const categoryInfo = async (req, res) => {
    try {

          let search="";
        if(req.query.search){
            search = req.query.search
        }

        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            $or: [
                { name: { $regex: new RegExp(".*" + search + ".*", "i") } },
                // { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        })
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit)
        res.render("category",{
            
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
            search,
        })

        
    } catch (error) {

        console.error(error)
        res.redirect("/pageerror")
        
    }
}



const addCategory = async (req,res) =>{
    const {name,description} = req.body 
    console.log(name, description)   
    try {

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp('^' + name + '$', 'i') }
        });
        
        if(existingCategory){
            
            return res.status(400).json({message:"Category already exists"})

        }
        const newCategory = new Category({
            name:name.trim(),
            description,
        })

        await newCategory.save()
        return res.json({message:"Category added successfully"})
        
    } catch (error) {

        return res.status(500).json({error:"Internal server error"})
        
    }
}

const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;

        // This function is called when "Unlist" button is clicked
        // It should set isListed to false (soft delete/unlist)
        const category = await Category.findById(id);
        if (!category) {
            if (req.headers.accept?.includes('application/json')) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }
            return res.redirect("/admin/category");
        }

        await Category.updateOne({_id: id}, {$set: {isListed: false}});

        // If it's an AJAX request, return JSON response
        if (req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                message: "Category unlisted successfully",
                categoryId: id,
                isListed: false
            });
        }

        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error unlisting category:", error);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
        res.redirect("/pageerror");
    }
}

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;

        // This function is called when "List" button is clicked
        // It should set isListed to true (restore/list)
        const category = await Category.findById(id);
        if (!category) {
            if (req.headers.accept?.includes('application/json')) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }
            return res.redirect("/admin/category");
        }

        await Category.updateOne({_id: id}, {$set: {isListed: true}});

        // If it's an AJAX request, return JSON response
        if (req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                message: "Category listed successfully",
                categoryId: id,
                isListed: true
            });
        }

        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error listing category:", error);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
        res.redirect("/pageerror");
    }
}


const geteditCategory = async (req,res) =>{
    try {
        const id = req.query.id;
        const error = req.query.error;
        const category = await Category.findOne({_id:id});

        if (!category) {
            return res.redirect("/admin/category");
        }

        res.render("editCategory", {
            category: category,
            error: error || null
        });

    } catch (error) {
        console.error("Error loading edit category page:", error);
        res.redirect("/pageerror");
    }
}


const editCategory = async (req, res) => {
    try {
        const id = req.params.id
        const {categoryName, description} = req.body;

        // Check if another category with the same name exists (excluding current category)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp('^' + categoryName + '$', 'i') },
            _id: { $ne: id }
        });

        if(existingCategory){
            // If it's an AJAX request, return JSON
            if (req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({
                    success: false,
                    error: "Category with this name already exists. Please choose another name."
                });
            }
            // For regular form submission, redirect with error message
            return res.redirect(`/admin/editCategory?id=${id}&error=Category with this name already exists`);
        }

        const updateCategory = await Category.findByIdAndUpdate(id, {
            name: categoryName.trim(),
            description: description
        }, {new: true});

        if(updateCategory){
            // If it's an AJAX request, return JSON success
            if (req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json')) {
                return res.json({
                    success: true,
                    message: "Category updated successfully"
                });
            }
            // For regular form submission, redirect to category list
            res.redirect("/admin/category");
        } else {
            if (req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json')) {
                return res.status(404).json({
                    success: false,
                    error: "Category not found"
                });
            }
            res.redirect(`/admin/editCategory?id=${id}&error=Category not found`);
        }

    } catch (error) {
        console.error("Error updating category:", error);
        if (req.headers['content-type'] === 'application/json' || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
        res.redirect(`/admin/editCategory?id=${req.params.id}&error=Internal server error`);
    }
}


const deleteCategory = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



module.exports ={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    geteditCategory,
    editCategory,
    deleteCategory
}


