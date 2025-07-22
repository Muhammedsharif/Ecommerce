    const User = require("../../models/userSchema")
    const Category = require("../../models/categorySchema")
    const Product = require("../../models/productSchema")
    const Wishlist = require("../../models/wishlistSchema")
    const { createReferralCode, processReferral } = require("./referralController")

    const env=require("dotenv").config()
    const nodemailer = require("nodemailer")
    const bcrypt = require("bcrypt")



    const pageNotFound=async (req,res)=>{

        try{
        
        res.render("page-404")
        
        }catch(error){
            res.redirect("/pageNotFound")
            console.log("error")
        }

    }

    const googleCallbackHandler = async (req, res) => {
  try {
    // Fetch the user from the database first
    const user = await User.findOne({ _id: req.user._id });
    if (!user) {
      return res.render("login", { message: "User not found" });
    }

    // Check if the user is blocked before setting the session
    if (user.isBlocked) {
      console.log("User is blocked:", user._id);
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.redirect("/pageNotFound");
        }
        return res.render("login", { message: "User is blocked by admin" });
      });
      return; 
    }

    // If user is not blocked, set the session and proceed
    req.session.user = req.user._id;
    console.log("User logged in via Google:", req.user._id);
    res.redirect("/");
  } catch (error) {
    console.error("Error in Google callback handler:", error);
    // Destroy session in case of error to prevent partial login states
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      res.redirect("/login");
   });
  }
};





    const loadHomepage = async (req, res) => {
  try {
    
    const user = req.session.user;

    // First, let's check all products in database
    const allProducts = await Product.find({});
    

    // Check products that are not blocked/deleted
    const activeProducts = await Product.find({
      isBlocked: false,
      isDeleted: false
    });
   

    // Get products with proper filters including category validation
    let productData = await Product.find({
      isBlocked: false,
      isDeleted: false
    }).populate({
      path: 'category',
      match: { isListed: true }
    });

  

    // Debug: Check variant quantities for first product
    // if (productData.length > 0) {
    //   console.log('First product variant data:', JSON.stringify(productData[0].variant, null, 2));
    // }

    // Filter out products with unlisted categories
    productData = productData.filter(product => product.category !== null);
  

    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    productData = productData.slice(0, 9);
    console.log('Final products to render:', productData.length);

    if (user) {
      const userData = await User.findById(user);
      res.render("home", { user: userData, products: productData, timestamp: new Date().toISOString() });
    }
    else {
      res.render("home", { products: productData, timestamp: new Date().toISOString() });
    }
  } catch (error) {
    console.log("Home page not found", error); // Log the full error
    res.status(500).send("Server error");
  }
};

    const loadSignup = async (req,res)=>{

        try{
            return res.render('signup',{
                message: null,
                name: "",
                email: "",
                phone: "",
                referralCode: ""
            })
        }catch(error){
            console.log('home page not loading:',error);
            res.status(500).send("server Error")
        }
    }

    function generateOtp(){
    
        return Math.floor(10000 + Math.random()*90000).toString()
        

    }

    async function sendVerificationEmail(email,otp){
        try {

            const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user: process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
            })

            const info = await transporter.sendMail({
                from :process.env.NODEMAILER_EMAIL,
                to:email,
                subject:"Verify your account",
                text:`Your OTP is ${otp}`,
                html:`<b>Your OTP: ${otp}</b>`
            })

            return info.accepted.length >0

            
        } catch (error) {

            console.error("Error sending email",error)
            return false
            
        }
    }

    const signup = async (req,res)=>{
        try{
            const {name,phone,email,password,confirmPassword,referralCode} = req.body
            console.log(req.body)

            if(password !== confirmPassword){
                return res.render("signup",{message:"Password do not match"})
            }

            const findUser = await User.findOne({email})



            if(findUser){
              
                return res.render("signup",{
                    message:"User with this email already exists",
                    name,
                    email,
                    phone,
                    referralCode

                })
            }

            // Validate referral code if provided
            if(referralCode && referralCode.trim()) {
                const referrer = await User.findOne({ referralCode: referralCode.trim() });
                if(!referrer) {
                    return res.render("signup",{
                        message:"Invalid referral code",
                        name,
                        email,
                        phone,
                        referralCode
                    });
                }
            }

            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email,otp)

            if(!emailSent){
                return res.json("email-error")
            }

            req.session.userOtp=otp
            req.session.userData={name,phone,email,password,referralCode}
            res.render("verify-otp")
            console.log("OTP Sent",otp)

        }catch(error){

            console.error("signup error",error)
            res.redirect("/pageNotFound")
        }
    }

    const securePassword = async (password)=>{
        try {
            const passwordHash = await bcrypt.hash(password,10)

            return passwordHash
        } catch (error) {
            
        }
    }

    const verifyOtp = async (req,res)=>{
        try{
            const {otp}=req.body
            console.log(otp)

            if(otp===req.session.userOtp){
                const user = req.session.userData
                const passwordHash = await securePassword(user.password)

                const saveUserData = new User({
                    name:user.name,
                    email:user.email,
                    phone:user.phone,
                    password:passwordHash
                })

                await saveUserData.save()

                // Generate referral code for new user
                const referralCode = await createReferralCode(saveUserData._id, user.name);
                if(referralCode) {
                    await User.findByIdAndUpdate(saveUserData._id, { referralCode });
                }

                // Process referral if user was referred
                if(user.referralCode && user.referralCode.trim()) {
                    await processReferral(saveUserData._id, user.referralCode.trim());
                }

                req.session.user = saveUserData._id
                res.json({success:true, redirectUrl:"/"})
            }else {
                res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
            }
        } catch (error){
            console.error("Error Verifying OTP",error)
            res.status(500).json({success:false,message:"An error occured"})
        }
    }


    const resendOtp = async (req,res)=>{
        try {
            const {email}=req.session.userData
            if(!email){
                return res.status(400).jspn({success:false,message:"Email not found"})
            }

            const otp = generateOtp()
            req.session.userOtp = otp

            const emailSent = await sendVerificationEmail(email,otp)
            if(emailSent){
                console.log("Resend OTP",otp)
                res.status(200).json({success:true,message:"OTP resend Successfully"})
            }else{
                res.status(500).json({success:false,message:"Failed to resend otp. Please try again"})
            }
        } catch (error) {
            console.error("Error resending OTP",error)
            res.status(500).json({success:false,message:"Internal Server Error. Please try again"})
        }
    }

    const loadLogin = async (req,res)=>{
        try {

            if(!req.session.user){
                return res.render("login",{
                    message: null,
                    email: "",
                    password: ""

                })
            }else{
               res.redirect("/")
            }
            
        } catch (error) {
            res.redirect("/pageNotFound")
        }
    }

    const login = async (req,res)=>{
        try {
            const {email,password} = req.body

            const findUser = await User.findOne({isAdmin:0,email:email})

            if(!findUser){
                return res.render("login",{
                    message:"User not found",
                    email,
                    password
                })
            }
            if(findUser.isBlocked){
              return  res.render("login",{message:"You are blocked by admin"})
            }

            const passwordMatch = await bcrypt.compare(password,findUser.password)

            if(!passwordMatch){
                return res.render("login",{message:"Invalid password",
                    email,
                    password
                })
            }

            req.session.user = findUser._id
            res.redirect("/")


        } catch (error) {

            console.log("Error in login",error)
            res.render("login",{message:"User not found"})
            
        }
    }

    const logout = async (req,res)=>{
        try {
            
            delete req.session.user;
            req.session.save((err) => {
                if(err){
                    console.log("Session save error",err.message)
                    return res.redirect("/pageNotFound")
                }
                return res.redirect("/login")
            })

        } catch (error) {

            console.log("Logout error",error);
            res.redirect("/pageNotFound")

        }
    }
    


const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const { page, sort } = req.query;
        const userId = req.session.user;

        const query = {
            isBlocked: false,
            isDeleted: false
        };

        let findProducts = await Product.find(query).populate({
            path: 'category',
            match: { isListed: true }
        }).lean();

        // Filter out products with unlisted categories
        findProducts = findProducts.filter(product => product.category !== null);

        // Add calculated pricing to each product for sorting
        findProducts = findProducts.map(product => {
            // Calculate lowest variant price for sorting with offers applied
            let lowestPrice = Infinity;

            if (product.variant && product.variant.length > 0) {
                product.variant.forEach(variant => {
                    const variantPrice = variant.varientPrice || 0;
                    
                    // Calculate offers: take the maximum of product offer and category offer
                    const productOffer = product.productOffer || 0;
                    const categoryOffer = product.category?.categoryOffer || 0;
                    const totalOffer = Math.max(productOffer, categoryOffer);
                    
                    // Apply the total offer to get final price
                    const finalPrice = totalOffer > 0 ?
                        Math.round(variantPrice - (variantPrice * totalOffer / 100)) :
                        variantPrice;

                    if (finalPrice < lowestPrice) lowestPrice = finalPrice;
                });
            }

            // Set calculated price for sorting (this is the final price after offers)
            product.calculatedLowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;

            return product;
        });

        // Apply sorting based on calculated prices
       
        switch (sort) {
            case 'price_asc':
                findProducts.sort((a, b) => a.calculatedLowestPrice - b.calculatedLowestPrice);
                
                break;
            case 'price_desc':
                findProducts.sort((a, b) => b.calculatedLowestPrice - a.calculatedLowestPrice);
                
                break;
            case 'name_asc':
                findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
                
                break;
            case 'name_desc':
                findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
                
                break;
            default:
                findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
        }
    
        
        const categories = await Category.find({ isListed: true }).lean();

        let wishlistIds = [];
        if (userId) {
            const userwish = await User.findById(userId);
            if (userwish && userwish.wishlist) {
                wishlistIds = userwish.wishlist.map(id => id.toString()); // Get only product IDs
            }
        }


        let itemsPerPage = 9;
        let currentPage = parseInt(page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProducts = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user }).lean();
        }

        req.session.filteredProducts = currentProducts;

        res.render("shop", {
            user: userData,
            products: currentProducts,
            
            categories: categories,
            totalPages,
            currentPage,
            selectedCategory: null,
            minPrice: '',
            maxPrice: '',
             rating: '0',
            query: { sort: sort || 'default' },
            userWishlist: wishlistIds
        });
    } catch (error) {
        console.error('Error in loadShoppingPage:', error);
        res.redirect("/pageNotFound");
    }
};

const filterProducts = async (req, res) => {
    try {
       
        
        const user = req.session.user;
        const { category, minPrice, maxPrice, rating, page, sort } = req.query;

       

        const query = {
            isBlocked: false,
            isDeleted: false
        };

        // Category filter
        if (category && category !== '') {
            const findCategory = await Category.findOne({ _id: category });
            if (findCategory) {
                query.category = findCategory._id;
            }
        }

        // Get products first without price filtering (since we need to filter by variant prices)
        let findProducts = await Product.find(query).populate({
            path: 'category',
            match: { isListed: true }
        }).lean();

        // Filter out products with unlisted categories
        findProducts = findProducts.filter(product => product.category !== null);

        // Add calculated pricing to each product for filtering and sorting
        findProducts = findProducts.map(product => {
            // Calculate lowest variant price for filtering and sorting with offers applied
            let lowestPrice = Infinity;
            let highestPrice = 0;

            if (product.variant && product.variant.length > 0) {
                product.variant.forEach(variant => {
                    const variantPrice = variant.varientPrice || 0;
                    
                    // Calculate offers: take the maximum of product offer and category offer
                    const productOffer = product.productOffer || 0;
                    const categoryOffer = product.category?.categoryOffer || 0;
                    const totalOffer = Math.max(productOffer, categoryOffer);
                    
                    // Apply the total offer to get final price
                    const finalPrice = totalOffer > 0 ?
                        Math.round(variantPrice - (variantPrice * totalOffer / 100)) :
                        variantPrice;

                    if (finalPrice < lowestPrice) lowestPrice = finalPrice;
                    if (finalPrice > highestPrice) highestPrice = finalPrice;
                });
            }

            // Set calculated prices for filtering/sorting (these are final prices after offers)
            product.calculatedLowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;
            product.calculatedHighestPrice = highestPrice;

            return product;
        });

        // Apply price range filter using calculated variant prices
        if (minPrice || maxPrice) {
            console.log('Applying price filter:', { minPrice, maxPrice });
            const originalCount = findProducts.length;

            findProducts = findProducts.filter(product => {
                const productPrice = product.calculatedLowestPrice;
                let passesFilter = true;

                if (minPrice && productPrice < parseFloat(minPrice)) {
                    passesFilter = false;
                }
                if (maxPrice && productPrice > parseFloat(maxPrice)) {
                    passesFilter = false;
                }

                return passesFilter;
            });

            console.log(`Price filter applied: ${originalCount} -> ${findProducts.length} products`);
        }

        // Apply sorting based on calculated prices
        console.log('Applying sort:', sort);
        switch (sort) {
            case 'price_asc':
                findProducts.sort((a, b) => a.calculatedLowestPrice - b.calculatedLowestPrice);
                console.log('Sorted by price ascending');
                break;
            case 'price_desc':
                findProducts.sort((a, b) => b.calculatedLowestPrice - a.calculatedLowestPrice);
                console.log('Sorted by price descending');
                break;
            case 'name_asc':
                findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
                console.log('Sorted by name A-Z');
                break;
            case 'name_desc':
                findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
                console.log('Sorted by name Z-A');
                break;
            default:
                findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                console.log('Sorted by creation date (default)');
        }

        const categories = await Category.find({ isListed: true }).lean();

        let userWishlist = [];
        if (user) {
                const userData = await User.findById(user).lean();
                    userWishlist = userData.wishlist.map(id => id.toString());
                }

        let itemsPerPage = 9;
        let currentPage = parseInt(page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProducts = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user }).lean();
            if (userData && category) {
                const searchEntry = {
                    category: category,
                    searchedOn: new Date(),
                };
                await User.updateOne(
                    { _id: user },
                    { $push: { searchHistory: searchEntry } }
                );
            }
        }

            req.session.filteredProducts = currentProducts;

        res.status(200).json({
            user: userData,
            products: currentProducts,
            categories: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            rating: rating || '0',
            totalProducts: findProducts.length,
            userWishlist,
            query: { sort: sort || 'default' }
        });
    } catch (error) {
        console.error('Error in filterProducts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const searchProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const { search } = req.body;
        const { page, sort, category, minPrice, maxPrice } = req.query;

        const categories = await Category.find({ isListed: true }).lean();
        
        // Build search query
        const query = {
            productName: { $regex: `.*${search}.*`, $options: 'i' },
            isBlocked: false,
            isDeleted: false
        };

        // Apply category filter if provided
        if (category && category !== '') {
            const findCategory = await Category.findOne({ _id: category });
            if (findCategory) {
                query.category = findCategory._id;
            }
        } else {
            // If no specific category, search in all listed categories
            const categoryIds = categories.map(category => category._id.toString());
            query.category = { $in: categoryIds };
        }

        let searchResult = await Product.find(query).populate({
            path: 'category',
            match: { isListed: true }
        }).lean();

        // Filter out products with unlisted categories
        searchResult = searchResult.filter(product => product.category !== null);

        // Add calculated pricing to each product for filtering and sorting
        searchResult = searchResult.map(product => {
            // Calculate lowest variant price for filtering and sorting with offers applied
            let lowestPrice = Infinity;

            if (product.variant && product.variant.length > 0) {
                product.variant.forEach(variant => {
                    const variantPrice = variant.varientPrice || 0;
                    
                    // Calculate offers: take the maximum of product offer and category offer
                    const productOffer = product.productOffer || 0;
                    const categoryOffer = product.category?.categoryOffer || 0;
                    const totalOffer = Math.max(productOffer, categoryOffer);
                    
                    // Apply the total offer to get final price
                    const finalPrice = totalOffer > 0 ?
                        Math.round(variantPrice - (variantPrice * totalOffer / 100)) :
                        variantPrice;

                    if (finalPrice < lowestPrice) lowestPrice = finalPrice;
                });
            }

            // Set calculated price for filtering/sorting (this is the final price after offers)
            product.calculatedLowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;

            return product;
        });

        // Apply price range filter using calculated variant prices
        if (minPrice || maxPrice) {
            searchResult = searchResult.filter(product => {
                const productPrice = product.calculatedLowestPrice;
                let passesFilter = true;

                if (minPrice && productPrice < parseFloat(minPrice)) {
                    passesFilter = false;
                }
                if (maxPrice && productPrice > parseFloat(maxPrice)) {
                    passesFilter = false;
                }

                return passesFilter;
            });
        }

        // Apply sorting based on calculated prices
        switch (sort) {
            case 'price_asc':
                searchResult.sort((a, b) => a.calculatedLowestPrice - b.calculatedLowestPrice);
                break;
            case 'price_desc':
                searchResult.sort((a, b) => b.calculatedLowestPrice - a.calculatedLowestPrice);
                break;
            case 'name_asc':
                searchResult.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'name_desc':
                searchResult.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            default:
                searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const itemsPerPage = 9;
        const currentPage = parseInt(page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProducts = searchResult.slice(startIndex, endIndex);
        const totalProducts = searchResult.length;

        let userData = null;
        if (user) {
            userData = await User.findById(user).select('name email').lean();
            await User.updateOne(
                { _id: user },
                { $push: { searchHistory: { searchedOn: new Date() } } }
            );
        }

        let userWishlist = [];
        if (user) {
            const userData = await User.findById(user).lean();
            userWishlist = userData.wishlist.map(id => id.toString());
        }

        req.session.filteredProducts = currentProducts;

        res.status(200).json({
            user: userData,
            products: currentProducts,
            categories: categories,
            totalPages,
            currentPage,
            totalProducts,
            selectedCategory: category || null,
            minPrice: minPrice || '',
            maxPrice: maxPrice || '',
            rating: '0',
            userWishlist,
            query: { sort: sort || 'default' }
        });
    } catch (error) {
        console.error('Error in searchProduct:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const getAllProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const { page } = req.query;

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());

        const products = await Product.find({
            isBlocked: false,
            isDeleted: false,
            category: { $in: categoryIds },
        }).lean();

        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const itemsPerPage = 9;
        const currentPage = parseInt(page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalPages = Math.ceil(products.length / itemsPerPage);
        const currentProducts = products.slice(startIndex, endIndex);
        const totalProducts = products.length; // Total product count

        let userData = null;
        if (user) {
            userData = await User.findById(user).select('name email').lean();
        }

        req.session.filteredProducts = null; // Clear filtered products

        let userWishlist = [];
        if (user) {
            const userData = await User.findById(user).lean();
            userWishlist = userData.wishlist.map(id => id.toString());
        }

        res.status(200).json({
            user: userData,
            products: currentProducts,
            totalPages,
            currentPage,
            totalProducts,
            userWishlist // Include total product count
        });
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};




    module.exports = {
        googleCallbackHandler,
        loadHomepage,
        pageNotFound,
        loadSignup,
        signup,
        verifyOtp,
        resendOtp,
        loadLogin,
        login,
        logout,
        loadShoppingPage,
        filterProducts,
        searchProduct,
        getAllProducts,
    }




    