const multer = require('multer')
const path = require("path")


const storage = multer.diskStorage({
    destination:(req,res,cb)=>{
        cb(null,path.join(__dirname,"../public/uploads/product-images"))
    },
    filename:(req,res,cb)=>{
        cb(null,Date.now()+"-"+File.originalname)
    }
})

module.exports = storage;