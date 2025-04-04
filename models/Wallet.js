const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    transactions: [
        {
            transactionType: { type: String, enum: ["credit", "debit"], required: true }, 
            transactionId: { type: String }, // For online payments, can store wallet transaction reference
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            description: { type: String },
        },
    ],
});

module.exports = mongoose.model("Wallet", walletSchema);
