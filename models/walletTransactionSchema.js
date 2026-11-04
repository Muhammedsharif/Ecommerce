const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
  
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    
   
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    
   
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    
    description: {
        type: String,
        required: true
    },
    
   
    orderId: {
        type: String,
        required: false
    },
    
  
    source: {
        type: String,
        enum: ['return_refund', 'order_payment', 'admin_credit', 'admin_debit', 'other'],
        required: true
    },
    
   
    balanceAfter: {
        type: Number,
        required: true
    },
    
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'],
        default: 'completed'
    },
    
  
    createdAt: {
        type: Date,
        default: Date.now
    },
    
   
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
});


walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);

module.exports = WalletTransaction;
