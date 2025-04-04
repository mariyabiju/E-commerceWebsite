

const bcrypt = require('bcrypt');
const Product = require("../models/Product"); 
const Category = require("../models/Category");
const Banner = require('../models/Banner');
const Offer = require('../models/Offer');
const User = require('../models/User');
const Coupon = require("../models/Coupons"); 
const Order = require("../models/Order");
const Rating = require("../models/Review");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const path = require('path');
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");

require("dotenv").config();



const razorpay = require("../config/razor"); // Import configured Razorpay instance
const Wallet = require("../models/Wallet"); // Ensure this model is correctly imported

// Generate a Razorpay order (user chooses amount to recharge)
exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body; // Amount in INR

        const options = {
            amount: amount * 100, // Convert to paisa
            currency: "INR",
            receipt: `wallet_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Handle successful payment and update wallet balance
exports.paymentSuccess = async (req, res) => {
    try {
        const { order_id, amount } = req.body;
        const userId = req.session.userId; // Get user ID from session

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) wallet = new Wallet({ userId, balance: 0, transactions: [] });

        wallet.balance += parseFloat(amount);
        wallet.transactions.push({
            transactionType: "credit",
            amount: parseFloat(amount),
            description: "Wallet Recharge",
        });

        await wallet.save();
        res.json({ success: true, message: "Wallet updated!" });
    } catch (error) {
        console.error("Error updating wallet:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Render wallet page
exports.getWalletPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 5; // Transactions per page

        // Fetch wallet details with transactions
        const wallet = await Wallet.findOne({ userId }) || { balance: 0, transactions: [] };

        // Paginate transactions
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const transactions = wallet.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by latest first
            .slice((page - 1) * limit, page * limit); // Pagination logic

        res.render("wallet", { 
            balance: wallet.balance, 
            razorpayKey: process.env.RAZORPAY_KEY_ID,
            transactions, 
            currentPage: page, 
            totalPages 
        });

    } catch (error) {
        console.error("Error fetching wallet data:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
