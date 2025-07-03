// Database configuration and connection setup
const mongoose = require("mongoose")
const env = require("dotenv").config()

// Asynchronous function to establish MongoDB connection
const connectDB= async ()=>{
        try{
            // Connect to MongoDB using connection string from environment variables
            await mongoose.connect(process.env.MONGODB_URI)
            console.log("DB connected")
        }catch(error){
            // Log error and exit process if database connection fails
            console.log("DB connection error",error.message)
            process.exit(1)
        }
}

// Export the connection function for use in main application
module.exports=connectDB