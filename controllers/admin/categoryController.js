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
            isListed: true, 
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
             name: { $regex: new RegExp(`^${name}$`, 'i') }
        })
        
        if(existingCategory){
            
            return res.status(400).json({error:"Category already exists"})

        }
        const newCategory = new Category({
            name,
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
        
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/category")
    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

const getUnlistCategory = async (req, res) => {
    
    try {
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/category")
    } catch (error) {

        res.redirect("/pageerror")
        
    }

}


const geteditCategory = async (req,res) =>{
    try {
        

        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("editCategory",{category:category})
        
    } catch (error) {

        res.redirect("/pageerror")
        
    }
}


const editCategory = async (req, res) => {
    try {

        const id = req.params.id
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({name:categoryName})

        if(existingCategory){
            return res.status(400).json({error:"category exists please choose another name"})
        }

        const updateCategory = await Category.findByIdAndUpdate(id ,{
            name:categoryName,
            description:description
        },{new:true})

        if(updateCategory){
            res.redirect("/admin/category")
        }else {
            res.status(404).json({error:"Category not found"})
        }
        
    } catch (error) {

        res.status(500).json({error:"Internal server error"})
        
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


