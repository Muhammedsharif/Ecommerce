// User model schema for the e-commerce application
const mongoose = require('mongoose');
const {Schema}=mongoose;

// Define user schema with all required fields for user management
const userSchema = new Schema({
    // User's full name - required field
    name:{
        type:String,
        required:true,
    },
    // User's email address - required and unique for authentication
    email:{
        type:String,
        required:true,
        unique:true
    },
    // User's phone number - optional field with sparse indexing
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true, // Allows multiple null values
        default:null
    },
    profileImage:{
        type:String,
        required:false,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse: true
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart"
    }],
    wallet:{
        type:Number,
        default:0
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Product"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referralCode:{
        type: String,
        unique: true,
        sparse: true
    },
    referredBy:{
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    referralCount:{
        type: Number,
        default: 0
    },
    coupons:[{
        couponId: {
            type: Schema.Types.ObjectId,
            ref: "Coupon"
        },
        isUsed: {
            type: Boolean,
            default: false
        },
        receivedDate: {
            type: Date,
            default: Date.now
        }
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})


const User=mongoose.model("User",userSchema)

module.exports=User;