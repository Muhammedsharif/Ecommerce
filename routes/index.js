// Central route index - imports and registers all route modules
const express = require('express');
const userRouter = require('./userRouter');
const adminRouter = require('./adminRouter');

function registerRoutes(app) {
    // User routes - mounted at root level
    app.use('/', userRouter);
    
    // Admin routes - mounted at /admin prefix
    app.use('/admin', adminRouter);
}

module.exports = {
    registerRoutes,
    userRouter,
    adminRouter
};