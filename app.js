const express=require("express")
const app=express()
const path=require("path")
const env=require("dotenv").config()
const db=require("./config/db")
const userRouter=require("./routes/userRouter")
db()


app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.set('views', path.join(__dirname, 'views'));
app.set("view engine","ejs")
app.use(express.static("public"));


app.use("/",userRouter)

app.listen(process.env.PORT,()=>console.log("Server running"))

module.exports=app