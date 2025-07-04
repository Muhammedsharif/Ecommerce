const mongoose = require("mongoose");
const { Schema } = mongoose;

// Wallet transaction schema for tracking all wallet-related transactions
const walletTransactionSchema = new Schema({
    // Reference to the user who owns this transaction
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
    // Transaction type: 'credit' for money added, 'debit' for money spent
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    
    // Transaction amount (always positive, type determines if it's added or subtracted)
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Description of the transaction
    description: {
        type: String,
        required: true
    },
    
    // Reference to related order (if applicable)
    orderId: {
        type: String,
        required: false
    },
    
    // Transaction source/reason
    source: {
        type: String,
        enum: ['return_refund', 'order_payment', 'admin_credit', 'admin_debit', 'other'],
        required: true
    },
    
    // Current wallet balance after this transaction
    balanceAfter: {
        type: Number,
        required: true
    },
    
    // Transaction status
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'],
        default: 'completed'
    },
    
    // Transaction timestamp
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // Additional metadata for the transaction
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
});

// Index for efficient queries
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);

module.exports = WalletTransaction;
