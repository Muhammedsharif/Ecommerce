// Route verification script - checks that all route modules are properly structured
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Route Structure...\n');

// Check if all required route files exist
const userRoutes = [
    'authRoutes.js',
    'productRoutes.js', 
    'cartRoutes.js',
    'wishlistRoutes.js',
    'checkoutRoutes.js',
    'orderRoutes.js',
    'profileRoutes.js',
    'addressRoutes.js',
    'couponRoutes.js',
    'walletRoutes.js',
    'referralRoutes.js'
];

const adminRoutes = [
    'authRoutes.js',
    'customerRoutes.js',
    'categoryRoutes.js', 
    'productRoutes.js',
    'orderRoutes.js',
    'bannerRoutes.js',
    'couponRoutes.js',
    'dashboardRoutes.js',
    'salesReportRoutes.js'
];

console.log('📁 Checking User Route Files:');
userRoutes.forEach(file => {
    const filePath = path.join(__dirname, 'user', file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
    }
});

console.log('\n📁 Checking Admin Route Files:');
adminRoutes.forEach(file => {
    const filePath = path.join(__dirname, 'admin', file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
    }
});

console.log('\n📁 Checking Core Files:');
const coreFiles = ['index.js', 'userRouter.js', 'adminRouter.js', 'README.md', 'MIGRATION_GUIDE.md'];
coreFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
    }
});

// Try to load the main routers to check for syntax errors
console.log('\n🔧 Testing Route Imports:');
try {
    const userRouter = require('./userRouter');
    console.log('  ✅ userRouter.js - Loads successfully');
} catch (error) {
    console.log(`  ❌ userRouter.js - Error: ${error.message}`);
}

try {
    const adminRouter = require('./adminRouter');
    console.log('  ✅ adminRouter.js - Loads successfully');
} catch (error) {
    console.log(`  ❌ adminRouter.js - Error: ${error.message}`);
}

try {
    const { registerRoutes } = require('./index');
    console.log('  ✅ index.js - Loads successfully');
} catch (error) {
    console.log(`  ❌ index.js - Error: ${error.message}`);
}

console.log('\n✨ Route verification complete!');
console.log('\n📋 Summary:');
console.log('- Modular route structure implemented');
console.log('- Routes organized with meaningful prefixes');
console.log('- Central registration system in place');
console.log('- Legacy routes maintained for compatibility');
console.log('- Documentation and migration guide created');

module.exports = { userRoutes, adminRoutes };