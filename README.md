# E-Commerce Application

A full-featured e-commerce web application built with Node.js, Express.js, MongoDB, and EJS templating.

## Features

### User Features
- **User Authentication**: Registration, login, logout with session management
- **Google OAuth**: Social login integration with Passport.js
- **Product Browsing**: Home page, shop page with category filtering
- **Product Details**: Detailed product view with size/color selection and dynamic pricing
- **Shopping Cart**: Add to cart, quantity management, remove items, empty cart
- **Wishlist**: Save products for later, move to cart functionality
- **User Profile**: Profile management with image upload, order history
- **Address Management**: Add, edit, delete, set default addresses
- **Order Management**: View order history, cancel orders

### Admin Features
- **Admin Dashboard**: Comprehensive admin panel
- **Product Management**: Add, edit, delete products with variant support
- **Category Management**: Manage product categories with soft delete
- **Brand Management**: Manage product brands
- **User Management**: View and manage user accounts
- **Order Management**: View and manage customer orders

### Technical Features
- **Variant-Based Pricing**: Products with multiple sizes and individual pricing
- **Stock Management**: Variant-level quantity tracking
- **Image Processing**: Sharp.js for image optimization
- **Email Integration**: Nodemailer for email notifications
- **Session Management**: Express-session for user state
- **Authentication Middleware**: Protected routes for users and admin
- **Responsive Design**: Mobile-friendly user interface

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: EJS templating, HTML5, CSS3, JavaScript
- **Authentication**: Passport.js with Google OAuth2.0
- **Image Processing**: Sharp.js
- **Email**: Nodemailer
- **Session Management**: Express-session
- **Password Hashing**: bcrypt

## Project Structure

```
├── app.js                 # Main application entry point
├── config/
│   ├── db.js              # Database connection configuration
│   └── passport.js        # Passport.js authentication setup
├── controllers/
│   ├── admin/             # Admin panel controllers
│   │   └── productController.js
│   └── user/              # User-facing controllers
│       ├── userController.js
│       ├── cartController.js
│       ├── wishlistController.js
│       └── profileController.js
├── middlewares/
│   ├── auth.js            # Authentication middleware
│   └── wishlistCount.js   # Wishlist count middleware
├── models/
│   ├── userSchema.js      # User data model
│   ├── productSchema.js   # Product data model with variants
│   ├── categorySchema.js  # Category data model
│   └── cartSchema.js      # Shopping cart data model
├── routes/
│   ├── userRouter.js      # User-facing routes
│   └── adminRouter.js     # Admin panel routes
├── views/
│   ├── user/              # User-facing EJS templates
│   │   ├── home.ejs
│   │   ├── shop.ejs
│   │   ├── productDetails.ejs
│   │   ├── cart.ejs
│   │   └── wishlist.ejs
│   └── admin/             # Admin panel EJS templates
│       ├── productAdd.ejs
│       └── editProduct.ejs
└── public/                # Static assets (CSS, JS, images)
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with required environment variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   EMAIL_USER=your_email_for_notifications
   EMAIL_PASS=your_email_password
   ```
4. Start the application: `npm start`

## Key Features Implementation

### Variant-Based Product System
- Products support multiple size variants with individual pricing and stock
- Dynamic price calculation based on selected size and quantity
- Automatic discount application from product and category offers

### Cart Management
- Real-time stock validation using variant quantities
- Automatic wishlist removal when items are added to cart
- Quantity increment/decrement with stock limits

### Authentication System
- Session-based authentication with middleware protection
- Google OAuth integration for social login
- User blocking/unblocking functionality

### Admin Product Management
- Dynamic form with size variant sections
- Real-time stock calculations from variants
- Image upload and processing with Sharp.js

## Recent Fixes and Improvements

1. **Variant Quantity Storage**: Fixed admin forms to properly save variant quantities
2. **Stock Validation**: Updated cart logic to use variant-based stock calculations
3. **Price Display**: Implemented comprehensive pricing system with discount calculations
4. **Template Syntax**: Fixed EJS template syntax errors for proper JavaScript execution
5. **Form Synchronization**: Added form value synchronization before submission

## Development Notes

- Server runs on port 3000 by default
- Uses nodemon for development with auto-restart
- MongoDB connection required for full functionality
- All routes are protected with appropriate authentication middleware
- Image uploads are processed and optimized using Sharp.js
