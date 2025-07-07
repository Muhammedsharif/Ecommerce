    const mongoose=require("mongoose")
    const {Schema}=mongoose

    const couponSchema=new mongoose.Schema({
        name:{
            type:String,
            required:true,
            unique:true
        },
        createdOn:{
            type:Date,
            default:Date.now,
            required:true
        },
        startDate:{
            type:Date,
            required:true,
            default:Date.now
        },
        expireOn:{
            type:Date,
            required:true
        },
        discountType:{
            type:String,
            enum:['flat', 'percentage'],
            required:true,
            default:'flat'
        },
        offerPrice:{
            type:Number,
            required:true
        },
        minimumPrice:{
            type:Number,
            required:true
        },
        applicableCategories:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Category"
        }],
        applicableProducts:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Product"
        }],
        isAllCategories:{
            type:Boolean,
            default:true
        },
        isAllProducts:{
            type:Boolean,
            default:true
        },
        maxUsesPerUser:{
            type:Number,
            default:1,
            min:1
        },
        totalUsageLimit:{
            type:Number,
            min:1
        },
        currentUsageCount:{
            type:Number,
            default:0,
            min:0
        },
        islist:{
            type:Boolean,
            default:true
        },
        userId:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }]
    })

    const Coupon=mongoose.model("Coupon",couponSchema)

    module.exports=Coupon