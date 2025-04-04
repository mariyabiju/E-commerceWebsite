const bcrypt = require('bcrypt');//product
const Product = require("../models/Product"); // Import Product model
const Category = require("../models/Category");
const Banner = require('../models/Banner');
const Offer = require('../models/Offer');
const User = require('../models/User');
const Coupon = require("../models/Coupons"); 
const Order = require("../models/Order");
const Rating = require("../models/Review");
const Cart = require("../models/Cart");
const Address = require("../models/Address");
const Wishlist = require("../models/Wishlist");
const Wallet = require("../models/Wallet");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require("dotenv").config();



const razorpay = require("../config/razor");

const path = require('path');
const { applyDiscounts } = require("../models/Product");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");

exports.getCartItems = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/product/home'); 
        
        }

        const userId = req.session.userId;
        console.log("User ID:", userId);

        // Fetch user's cart
        const cart = await Cart.findOne({ userId});
        const address= await Address.findOne({userId});

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render("cart", { cart: null });
        }
        // Extract all product IDs from cart and convert them to ObjectId
        const productIds = cart.items.map(item => new mongoose.Types.ObjectId(item.productid));


        // Fetch full product details from Product collection
        const products = await Product.find({ _id: { $in: productIds } });

        if (!products || products.length === 0) {
            console.log("No products found for given cart items.");
            return res.render("cart", { cart: null });
        }

        // Map product details into cart items
        const cartItems = cart.items.map(item => {
            // Find the matching product from the Product collection
            const product = products.find(p => p._id.toString() === item.productid.toString());
        
            if (!product) {
                console.error("Product not found for ID:", item.productid);
                return null;  // Skip if product is deleted
            }
            const price= product.price;
            const discountedPrice=product.discountedPrice;
            const finalDiscount=product.finalDiscount;
             // Extract available sizes
    const availableSizes = [...new Set(product.variants.map(v => v.size))];

    // Filter colors based on the selected size
    const availableColors = [...new Set(
        product.variants
            .filter(v => v.size === item.size) // Get only colors for the selected size
            .map(v => v.color)
    )];

    // Find the selected variant based on size and color
    const variant = product.variants.find(v => v.size === item.size && v.color === item.color);
    const stock = variant ? variant.stock : 0; // Get stock for the selected size & color
        
            return {
                _id: item._id,
                productid: item.productid.toString(),
                productName: product.productName,
                image: product.imageUrls?.[0] || "/default-image.jpg", // Use first image
                price,
                finalDiscount,
                discountedPrice:item.discountedPrice,
                color: item.color,
                size: item.size,
                availableSizes,  // Add available sizes
                availableColors, // Add available colors
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                pricePerUnit:item.pricePerUnit,
                stock, 
                description: product.description,
                category: product.category,
                brand: product.brand,
                sellerDetails: product.sellerDetails,
               
            };
        }).filter(Boolean); // Remove null values
        
            // Fetch user's addresses
const addresses = await Address.find({ userId, isDeleted: false });

const hasAlphabet = (obj) => {
    if (!obj) return false;
    return Object.values(obj).some(value => /[a-zA-Z]/.test(value));
};

// Default address: First 'Home' type address or first available address
const defaultAddress = addresses.find(a => a.type === "Home") || addresses[0] || null;

// Get selected address from session, else use default
let selectedAddress = req.session.selectedAddressId
    ? addresses.find(a => a._id.toString() === req.session.selectedAddressId)
    : defaultAddress || {}; // Ensure it is at least an empty object

// Ensure home and work addresses are always defined
const homeAddress = addresses.find(a => a.type === "Home") || {};
const workAddress = addresses.find(a => a.type === "Work") || {};

// If selected address lacks 'houseName', use default
if (!selectedAddress?.houseName && defaultAddress) {
    selectedAddress = defaultAddress;
}

        // **Recalculate Totals**
        let totalMRP = 0;
        let totalDiscount = 0;
        let finalAmount = 0;

        cart.items.forEach(item => {
            totalMRP += item.totalPrice; // Use stored total price
            totalDiscount += (item.totalPrice - item.discountedPrice); // Difference between total price and discounted price
            finalAmount += item.discountedPrice; // Sum of discounted prices
        });

        // Apply coupon discount if available (stored in session)
        let couponDiscount = req.session.couponDiscount || 0;
        finalAmount -= couponDiscount;

        const userOrders = await Order.find({ customerId: req.session.userId });
// Get user details
const user = await User.findById(userId);
if (!user) {
    return res.json({ status: "error", message: "User not found!" });
}


// Get all non-deleted coupons where `createdBy` is NOT "referral"
let coupons = await Coupon.find({ isDelete: false, createdBy: { $ne: "referral" } });

// Check if user has previous orders
if (userOrders.length > 0) {
    coupons = coupons.filter(coupon => coupon.code !== "NEWUSER");
}

// Initialize arrays for categorized coupons
let referralCoupons = [];
let rewardCoupons = [];

// Check if user has been referred
if (user.referredBy&&!userOrders.length > 0) {
    referralCoupons = await Coupon.find({ code : "REFERRAL COUPON", isDelete: false });
}

// Check if any user has `RewardGive: true`
if (user.RewardGive) {
    rewardCoupons = await Coupon.find({ code: "REWARD", isDelete: false });
}

// Combine all applicable coupons
let applicableCoupons = [...coupons, ...referralCoupons, ...rewardCoupons];


        res.render("cart", {
            cart: { items: cartItems },
            productIds,
            address: selectedAddress,
            allAddresses: addresses ,
            isAddressValid: hasAlphabet(selectedAddress),
            totalMRP,
            totalDiscount,
            couponDiscount,
            finalAmount,
            coupons :applicableCoupons
        }); 


    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getCartCount=async (req, res) => {
    try {
        if (!req.session.userId) return res.json({ count: 0 });

        const userId = req.session.userId;
        const cart = await Cart.findOne({ userId });
        
        const totalItems = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        res.json({ count: totalItems });
    } catch (error) {
        console.error(error);
        res.status(500).json({ count: 0 });
    }
};


exports.addToCart = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.userId) {
            return res.status(401).json({ status: "error", message: "Please log in first!" });
        }
        const { productid, size, color, quantity } = req.body;
        const userId = req.session.userId;

        // Check if product exists and is not blocked
        const product = await Product.findById(productid).populate("category");
        if (!product || product.isDeleted || (product.category && product.category.isDeleted)) {
            return res.status(400).json({ status: "error", message: "This product is unavailable!" });
        }

        // Ensure user selected size and color
        if (!size || !color) {
            return res.status(400).json({ status: "error", message: "Please choose size and color before adding to cart!" });
        }

        // Find the selected variant
        const selectedVariant = product.variants.find(variant => variant.size === size && variant.color === color);
        if (!selectedVariant) {
            return res.status(400).json({ status: "error", message: "Selected size and color combination is not available!" });
        }
 
        // Check stock availability
        if (selectedVariant.stock < 1) {
            return res.status(400).json({  status: "out_of_stock", message: "This product is out of stock. Add to wishlist instead!" });
        }

        // Check if cart exists for the user
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Check if product already exists in the cart with the same size and color
        const existingItem = cart.items.find(item => 
            item.productid.equals(productid) && item.size === size && item.color === color
        );

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * product.price;
            existingItem.discountedPrice = existingItem.quantity * product.discountedPrice;
        } else {
            cart.items.push({
                productid,
                color,
                size,
                pricePerUnit: product.price,
                discountedPrice: product.discountedPrice * quantity,
                quantity,
                finalDiscount: product.finalDiscount,
                totalPrice: quantity * product.price
            });
        }

        // **Recalculate Totals**
        let totalMRP = 0;
        let totalDiscount = 0;
        let finalAmount = 0;
        let couponDiscount = 0;

        cart.items.forEach(item => {
            totalMRP += item.totalPrice; // Use stored total price
            totalDiscount += (item.totalPrice - item.discountedPrice); // Difference between total price and discounted price
            finalAmount += item.discountedPrice; // Sum of discounted prices
        });

        // Remove the product from wishlist if it exists**
        await Wishlist.updateOne(
            { userId },
            { $pull: { items: { productid: productid } } } // Removes the product from wishlist
        );

        // Save updated cart
        await cart.save();
        
        if (existingItem) {
            // Show SweetAlert if the product is already in the cart
            return res.status(200).json({
                status: "exists", 
                message: "Product already in cart! Quantity updated.",
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalAmount
            });
        }
        return res.status(200).json({ 
            status: "success", 
            message: "Product added to cart!", 
            totalMRP, 
            totalDiscount, 
            couponDiscount, 
            finalAmount 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
};

exports.updateCart = async (req, res) => {
    try {
        const { itemId, size, color, quantity } = req.body;
        
        if (!itemId || !size || !color || !quantity) {
            return res.status(400).json({ success: false, message: "Missing required fields!" });
        }

        // Find the cart that contains the item
        const cart = await Cart.findOne({ "items._id": itemId });

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found!" });
        }

        // Find the specific item inside the cart
        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not found in cart!" });
        }
       // Find the stock availability of the selected variant
       const product = await Product.findOne({ _id: cart.items[itemIndex].productid });

       if (!product) {
           return res.status(404).json({ success: false, message: "Product not found!" });
       }

       // Find the variant stock
       const selectedVariant = product.variants.find(variant => variant.size === size && variant.color === color);

       if (!selectedVariant) {
           return res.status(400).json({ success: false, message: "Invalid size or color selected!" });
       }

       if (selectedVariant.stock === 0) {
           return res.json({ status: "out_of_stock", message: "Selected variant is out of stock!" });
       }


        // Update item properties
        cart.items[itemIndex].size = size;
        cart.items[itemIndex].color = color;
        cart.items[itemIndex].quantity = quantity;

        // Recalculate total price and discounted price for the updated item
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].pricePerUnit * quantity;
        cart.items[itemIndex].discountedPrice = parseFloat(
            (cart.items[itemIndex].pricePerUnit * (1 - cart.items[itemIndex].finalDiscount / 100) * quantity).toFixed(2)
        );

        // Save updated cart
        await cart.save();

        // **Recalculate Totals**
        let totalMRP = 0;
        let totalDiscount = 0;
        let finalAmount = 0;

        cart.items.forEach(item => {
            totalMRP += item.totalPrice; // Use stored total price
            totalDiscount += (item.totalPrice - item.discountedPrice); // Difference between total price and discounted price
            finalAmount += item.discountedPrice; // Sum of discounted prices
        });

        // Apply coupon discount if available (stored in session)
        let couponDiscount = req.session.couponDiscount || 0;
        finalAmount -= couponDiscount;

        // Send response with updated values
        return res.json({ 
            success: true, 
            updatedItem: {
                ...cart.items[itemIndex].toObject(),
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalAmount
            }
        });

    } catch (error) {
        console.error("Error updating cart:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.updateDefaultAddress = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { addressId } = req.body;
        const userId = req.session.userId;

        const address = await Address.findOne({ _id: addressId, userId, isDeleted: false });
         
        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }
        req.session.selectedAddressId = addressId;

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating default address:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


exports.getCheckoutPage = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/product/home');
        }

        const userId = req.session.userId;
        const cart = await Cart.findOne({ userId });
        const addresses = await Address.find({ userId, isDeleted: false }).populate('userId', 'fname lname emailId phoneNumber');
        const wallet = await Wallet.findOne({ userId }) || { balance: 0 };
                
              
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render("checkout", { cart: null, address: null, fullName: "" });
        }

        const productIds = cart.items.map(item => new mongoose.Types.ObjectId(item.productid));
        const products = await Product.find({ _id: { $in: productIds } });

        const cartItems = cart.items.map(item => {
            const product = products.find(p => p._id.toString() === item.productid.toString());
            if (!product) return null;

            return {
                _id: item._id,
                productName: product.productName,
                image: product.imageUrls?.[0] || "/default-image.jpg",
                price: product.price,
                discountedPrice: item.discountedPrice,
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                description: product.description
            };
        }).filter(Boolean);

        const defaultAddress = addresses.find(a => a.type === "Home") || addresses[0] || null;

        let selectedAddress = req.session.selectedAddressId
            ? addresses.find(a => a._id.toString() === req.session.selectedAddressId)
            : defaultAddress;

        // Ensure fullName is correctly assigned and prevents errors
        let fullName = "";
        if (selectedAddress && selectedAddress.userId) {
            fullName = `${selectedAddress.userId.fname} ${selectedAddress.userId.lname}`;
        }
        let emailId=selectedAddress.userId.emailId;
        let phoneNumber=selectedAddress.userId.phoneNumber;

        res.render("checkout", {
            cart: { items: cartItems },
            address: selectedAddress,
            allAddresses: addresses,
            fullName,
            emailId,
            walletBalance: wallet ? wallet.balance : 0 ,
            razorpayKey: process.env.RAZORPAY_KEY_ID ,
            phoneNumber
        });

    } catch (error) {
        console.error("Error loading checkout:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.removeCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ status: "error", message: "Please log in first!" });

        const { productId } = req.params;
        console.log(productId);
        let cart = await Cart.findOne({ userId });

        if (!cart) return res.status(404).json({ status: "error", message: "Cart not found!" });

        // Filter out the removed item
        cart.items = cart.items.filter(item => !item._id.equals(productId));

        // **Recalculate Totals**
        let totalMRP = 0;
        let totalDiscount = 0;
        let finalAmount = 0;

        cart.items.forEach(item => {
            totalMRP += item.totalPrice;
            totalDiscount += (item.totalPrice - item.discountedPrice);
            finalAmount += item.discountedPrice;
        });

        // Apply coupon discount if available
        let couponDiscount = req.session.couponDiscount || 0;
        finalAmount -= couponDiscount;

        await cart.save();

        res.json({ 
            status: "success", 
            message: "Product removed from cart!", 
            updatedItem: {
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalAmount
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
};

exports.wishlistCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartItemId = req.params.cartItemId; // _id of the cart item


        // Find the cart item using its _id
        const userCart = await Cart.findOne({ "items._id": cartItemId });

        if (!userCart) {
            return res.status(404).json({ status: "error", message: "Cart item not found" });
        }

        // Find the specific cart item in the array
        const cartItem = userCart.items.find(item => item._id.toString() === cartItemId);

        if (!cartItem) {
            return res.status(404).json({ status: "error", message: "Cart item not found" });
        }

        const productId = cartItem.productid.toString();
     
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        // Check if the product is already in the wishlist
        const isInWishlist = wishlist.items.some(item => item.productid.equals(productId));

        if (!isInWishlist) {
            wishlist.items.push({ productid: productId });
            await wishlist.save();
        }

        // Remove the item from the cart
        await Cart.updateOne({ userId }, { $pull: { items: { _id: cartItemId } } });

        // Fetch updated cart
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ status: "error", message: "Cart not found" });
        }

        // Recalculate Totals
        let totalMRP = 0;
        let totalDiscount = 0;
        let finalAmount = 0;
        let couponDiscount = req.session?.couponDiscount || 0;

        cart.items.forEach(item => {
            totalMRP += item.totalPrice;
            totalDiscount += (item.totalPrice - item.discountedPrice);
            finalAmount += item.discountedPrice;
        });

        finalAmount -= couponDiscount;

        // Save the updated cart
        await cart.save();

        return res.json({
            status: "success",
            message: "Product moved to wishlist, cart updated",
            updatedItem: {
                totalMRP,
                totalDiscount,
                couponDiscount,
                finalAmount
            }
        });

    } catch (error) {
        console.error("Error moving product to wishlist:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

exports.getWishlist = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.redirect("/product/home");
        }

        // Fetch wishlist for the logged-in user
        const wishlist = await Wishlist.findOne({ userId }).populate("items.productid");

        return res.render("wishlist", { wishlistItems: wishlist ? wishlist.items : [] });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        return res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
};

exports.addToWishlist = async (req, res) => {
    try {
        const { productid } = req.body;
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({ status: "error", message: "Please log in first!" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        const existingWishlistItem = wishlist.items.find(item => item.productid.equals(productid));
        if (existingWishlistItem) {
            return res.status(200).json({ status: "info", message: "Product is already in your wishlist!" });
        }

        wishlist.items.push({ productid });
        await wishlist.save();

        return res.status(200).json({ status: "success", message: "Product added to wishlist!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
};

exports.checkStockAvailability = async (req, res) => {
    try {
        const userId = req.session.userId;
        const cart = await Cart.findOne({ userId });

        if (!cart || !cart.items.length) {
            return res.json({ outOfStockItems: [] });
        }

        // Fetch product details from the database
        const productIds = cart.items.map(item => item.productid);
        const products = await Product.find({ _id: { $in: productIds } });

        let outOfStockItems = [];

        cart.items.forEach(item => {
            let product = products.find(p => p._id?.toString() === item.productid?.toString());

            if (product && Array.isArray(product.variants)) {
                // Find the variant based on size and color (since variantid is not stored in cart)
                let variant = product.variants.find(v => 
                    v.size === item.size && v.color === item.color
                );

                if (variant && variant.stock <= 0) {
                    outOfStockItems.push({
                        productid: item.productid,
                        size: item.size,
                        color: item.color
                    });
                }
            }
        });

        return res.json({ outOfStockItems });

    } catch (error) {
        console.error("Error checking stock:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


exports.getAddressById = async (req, res) => {
    try {
        const { addressId } = req.params; // Extract the address ID from the request parameters

        // Find the address by ID and ensure it's not deleted
        const address = await Address.findOne({ _id: addressId, isDeleted: false });

        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }
        console.log(address);

        res.status(200).json({ success: true, address });

    } catch (error) {
        console.error("Error fetching address:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};



exports.placeOrder = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { paymentMethod, address, totalMRP, totalDiscount, couponDiscountValue, shippingFee, finalAmount,transactionId } = req.body;

        // Fetch user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productid");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: "Your cart is empty." });
        }

        // Fetch user's wallet
        let wallet = await Wallet.findOne({ userId });

        if (paymentMethod === "Wallet") {
            if (!wallet || wallet.balance < finalAmount) {
                return res.status(400).json({ error: "Insufficient wallet balance." });
            }

            // Deduct the amount from the wallet
            wallet.balance -= finalAmount;
            wallet.transactions.push({
                transactionType: "debit",
                transactionId: `TXN-${Date.now()}`, // Unique transaction reference
                amount: finalAmount,
                date: new Date(),
                description: "Order Payment using Wallet",
            });
        
            await wallet.save();
        }

        // Determine shipping fee value
        const shippingFeeValue = shippingFee === "Free" ? 0 : Number(shippingFee);

        // Generate unique order number
        const orderCount = await Order.countDocuments();
        const newOrderNumber = `ORD${orderCount + 1}`;

        // Map cart items to order products
        const orderItems = cart.items.map(item => ({
            productid: item.productid._id,
            color: item.color,
            size: item.size,
            pricePerUnit: item.pricePerUnit,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            discountedPrice: item.discountedPrice,
            finalDiscount: item.finalDiscount
        }));

        // Create the order
        const order = new Order({
            orderNumber: newOrderNumber,
            customerId: userId,
            products: orderItems,
            address,
            paymentDetails: {
                method: paymentMethod,
                transactionId: transactionId || null,
                paymentStatus: paymentMethod === "COD" ? "Pending" : "Completed",
            },
            orderSummary: {
                subtotal: totalMRP,
                discount: totalDiscount,
                couponDiscount: couponDiscountValue,
                shippingFee: shippingFeeValue,
                total: finalAmount,
            },
            status: "Pending"
        });

        await order.save();
        await Cart.findOneAndDelete({ userId }); // Clear cart after order placement

        // Handle coupon removal
        //await Coupon.findOneAndUpdate(
           // { referredUserId: userId, code: /^WELCOME/, createdBy: "referral", isDelete: false },
           // { isDelete: true }
        //);

        // Update user reward status
        await User.findOneAndUpdate(
            { _id: userId },
            { $set: { RewardGive: false } }
        );

        res.json({ message: "Order placed successfully", orderId: order._id, orderNumber: order.orderNumber });

    } catch (error) {
        console.error("Order Placement Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

exports.getOrders = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect("/product/home");
        }

        const userId = req.session.userId;
        const { filter, tab = "pendingOrders", page = 1 } = req.query; 
        const pageSize = 3; 
        const skip = (page - 1) * pageSize;
        
        let dateFilter = {};
        const now = moment();

        if (filter === "today") {
            dateFilter = {
                orderDate: {
                    $gte: now.startOf("day").toDate(),
                    $lte: now.endOf("day").toDate(),
                },
            };
        } else if (filter === "last_month") {
            dateFilter = {
                orderDate: {
                    $gte: now.subtract(1, "months").startOf("day").toDate(),
                },
            };
        }
        let orders = await Order.find({ customerId: userId, ...dateFilter }).lean();
        orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        for (let order of orders) {
            order.products = await Promise.all(
                order.products.map(async (product) => {
                    const productDetails = await Product.findById(product.productid).lean();
                    return {
                        ...productDetails,
                        quantity: product.quantity,
                        return_cancel: product.return_cancel ?? {
                            cancelRequested: false,
                            returnRequested: false,
                            returnStatus: "",
                            returnReason: "",
                            refundMethod: "",
                            returnInitiated: false,
                        },
                        refundSuccess: product.refundSuccess ?? false,
                        refundGivenMethod: product.refundGivenMethod ?? "",
                    };
                })
            );
        }
        // Categorize orders
        const pendingOrders = orders.filter(order => order.status === "Pending" || order.status === "Shipped");
        const deliveredOrders = orders.filter(order => order.status === "Delivered");
        const cancelledOrders = orders
            .filter(order => order.status === "Cancelled")
            .map(order => ({
                ...order,
                refund: order.products.some(product => product.refundSuccess),
                refundMethod: order.products.find(product => product.refundGivenMethod)?.refundGivenMethod || ""
            }));

        // Pagination data
        const paginatedData = {
            pendingOrders: {
                data: pendingOrders.slice(skip, skip + pageSize),
                totalPages: Math.ceil(pendingOrders.length / pageSize),
            },
            deliveredOrders: {
                data: deliveredOrders.slice(skip, skip + pageSize),
                totalPages: Math.ceil(deliveredOrders.length / pageSize),
            },
            cancelledOrders: {
                data: cancelledOrders.slice(skip, skip + pageSize),
                totalPages: Math.ceil(cancelledOrders.length / pageSize),
            }
        };
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.render('orderHistory', { 
                deliveredOrders: tab === 'deliveredOrders' ? paginatedData.data : [],
                cancelledOrders: tab === 'cancelledOrders' ? paginatedData.data : [],
                pendingOrders: tab === 'pendingOrders' ? paginatedData.data : [],
                currentPage: parseInt(page),
                totalPagesCancelled: paginatedData.totalPages
            });
        }
        
        res.render("orderHistory", { 
            pendingOrders: paginatedData.pendingOrders.data, 
            deliveredOrders: paginatedData.deliveredOrders.data, 
            cancelledOrders: paginatedData.cancelledOrders.data, 
            filter, 
            activeTab: tab, 
            currentPage: parseInt(page),
            totalPagesPending: paginatedData.pendingOrders.totalPages,
            totalPagesDelivered: paginatedData.deliveredOrders.totalPages,
            totalPagesCancelled: paginatedData.cancelledOrders.totalPages,
        });
    
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Server Error");
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId, customerId: req.session.userId })
            .populate("products.productid")
            .lean();
            let length = order.products.length; 
            let a = 0;
        if (!order) return res.status(404).send("Order not found");


        let updatedTotal = order.orderSummary.total;
        let updatedSubtotal = order.orderSummary.subtotal;
        let totalRefundAmount = 0;
        const productsWithDetails = order.products.map(item => {
            const product = item.productid;

            if (!product) {
                console.error("Product not found for item:", item);
                return null; // Skip null product items
            }

            let productStatus = order.status;

        // Check for order cancellation
        if (item.isDelete){
             productStatus = "Cancelled";
             a++;
       }
       
     
// Check for returns after delivery
if (order.status === "Delivered" && item.return_cancel?.returnRequested) {
    productStatus = "Returned";
    a++;
    if (item.return_cancel.returnInitiated && item.return_cancel.returnStatus === "Accepted") {
        totalRefundAmount += item.discountedPrice; // Add discounted price to refund amount
    }
}

// Refund message logic
let refundMessage = "";

// Case 1: Order was deleted (Cancelled) 
if (item.isDelete) {
    if (item.refundSuccess) {
        refundMessage = `Refunded via ${item.refundGivenMethod}`;
    } else {
        refundMessage = "Refund Pending";
    }
}
// Case 2: Order was Delivered and a return was requested
else if (order.status === "Delivered" && item.return_cancel?.returnRequested) {
    if (item.return_cancel?.returnStatus === "Accepted") {
        
        refundMessage =  `Refunded via ${item.return_cancel.refundMethod}` ;
            
    } else if (item.return_cancel?.returnStatus === "Pending") {
        refundMessage = "Return request pending approval";
    } else {
        refundMessage = "Return initiated, waiting for update";
    }
}
// Case 3: No cancellation or return request (default case)
else {
    refundMessage = "";
}


            return {
                productid: product._id,
                name: product.productName || "Unknown Product",
                description: product.description || "No description available",
                brand: product.brand || "Unknown Brand",
                productDetails: product.productDetails || "No details available",
                sellerDetails: product.sellerDetails || "Seller info not available",
                images: product.imageUrls?.length ? product.imageUrls[0] : ["/images/default.jpg"], 
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                discountedPrice: item.discountedPrice.toFixed(2),
                totalPrice: item.totalPrice,
                finalDiscount: item.finalDiscount,
                productStatus,
                refundMessage,
                isDelete: item.isDelete,
                return_cancel:item.return_cancel,
            };
        }).filter(Boolean);
        let flag = a === length ? 'true' : 'false';
        order.flag=flag
        const allOrders = {
            ...order,
            products: productsWithDetails,
            totalRefundAmount,
            orderStatusMessage: order.status === "Pending" ? "Your order is pending."
                : order.status === "Cancelled" ? "Your order has been cancelled."
                : order.status === "Delivered" && order.refund ? `Order delivered. Refund processed via ${order.refundMethod}.`
                : "Your order has been delivered.",
            orderSummary: {
                shippingFee: order.orderSummary.shippingFee,
                shippingMethod: order.orderSummary.shippingMethod,
                subtotal: updatedSubtotal,
                discount: order.orderSummary.discount,
                couponDiscount: order.orderSummary.couponDiscount,
                total: updatedTotal
            }
        };

        // Render the orders page with only the selected order
        res.render("orderDetails", {  allOrders });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Server Error");
    }
};


// Update order status (Admin)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });

        res.redirect(`/order/${req.params.id}`);
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).send("Server Error");
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const { orderId, refundMethod } = req.body;

        // Fetch the order with customer details
        const order = await Order.findById(orderId).populate("customerId");

        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        order.status = "Cancelled";
        let refundAmount = order.orderSummary.total;
        let refundSuccess = false;
        let refundGivenMethod = "";

        // Handle Refund Logic
        if (refundAmount > 0 && order.paymentDetails.method !== "COD") {
            if (refundMethod === "Wallet") {
                // Find or create wallet
                let wallet = await Wallet.findOne({ userId: order.customerId });

                if (!wallet) {
                    wallet = new Wallet({
                        userId: order.customerId,
                        balance: 0,
                        transactions: [],
                    });
                }

                // Update wallet balance
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    transactionType: "credit",
                    amount: refundAmount,
                    description: "Refund for canceled order",
                    date: new Date(),
                });

                await wallet.save();
                refundSuccess = true;
                refundGivenMethod = "Wallet";
            } else if (["card", "upi"].includes(refundMethod)) {
                // Refund via Razorpay
                const refund = await razorpay.payments.refund(order.paymentDetails.transactionId, {
                    amount: refundAmount * 100, // Convert to paise
                });

                if (refund.status === "processed") {
                    order.paymentDetails.refundId = refund.id;
                    order.paymentDetails.paymentStatus = "Refunded";
                    refundSuccess = true;
                    refundGivenMethod = "Direct Bank";
                }
            }
        }

        // Set refund status for the entire order instead of each product
        if (refundSuccess) {
            order.refund = true;
            order.refundMethod = refundGivenMethod;
        }

        await order.save();

        // Restore stock for all canceled products
        for (let orderedProduct of order.products) {
            const productDoc = await Product.findById(orderedProduct.productid);
            if (productDoc) {
                const variant = productDoc.variants.find(
                    (v) => v.size === orderedProduct.size && v.color === orderedProduct.color
                );
                if (variant) {
                    variant.stock += orderedProduct.quantity;
                    await productDoc.save();
                    console.log(`Stock restored for ${productDoc.productName} (${orderedProduct.size}, ${orderedProduct.color})`);
                }
            }
        }

        return res.json({
            success: true,
            message: "Order cancelled successfully. Refund processed if applicable.",
            redirectUrl: "/product/orders",
        });
    } catch (error) {
        console.error("Error cancelling order:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
};


exports.cancelProduct = async (req, res) => {
    try {
        const { orderId, productIds, refundMethod } = req.body;

        const order = await Order.findById(orderId).populate("customerId");
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        let refundAmount = 0;
        let refundSuccess = false;
        let refundGivenMethod = "";

        order.products.forEach(product => {
            if (productIds.includes(product.productid.toString())) {
                product.isDelete = true;
                refundAmount += product.discountedPrice;
            }
        });

        // Recalculate order summary
       // Update order summary when a product is cancelled
order.orderSummary.subtotal = order.products.reduce((sum, p) => sum + (p.isDelete ? 0 : p.totalPrice), 0);
order.orderSummary.discount = order.products.reduce((sum, p) => sum + (p.isDelete ? 0 : p.totalPrice - p.discountedPrice), 0);

// Check if the new discounted price is less than 600
if (order.orderSummary.subtotal - order.orderSummary.discount < 600) {
    // Add the coupon discount to the total discount
    order.orderSummary.discount += order.orderSummary.couponDiscount;
    
    // Remove the coupon discount
    order.orderSummary.couponDiscount = 0;
}

// Recalculate the total price
order.orderSummary.total = order.orderSummary.subtotal - order.orderSummary.discount - order.orderSummary.couponDiscount;


        await order.save();

        // Handle Refund Logic
        if (refundAmount > 0 && order.paymentDetails.method !== "COD") {
            if (refundMethod === "Wallet") {
                // Find user's wallet or create one if it doesn't exist
                let wallet = await Wallet.findOne({ userId: order.customerId });

                if (!wallet) {
                    wallet = new Wallet({
                        userId: order.customerId,
                        balance: 0,
                        transactions: []
                    });
                }

                // Update wallet balance and add transaction
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    transactionType: "credit",
                    amount: refundAmount,
                    description: "Refund for canceled product",
                    date: new Date(),
                });

                // Save the updated wallet
                await wallet.save();

                refundSuccess = true;
                refundGivenMethod = "Wallet";
            } else if (["card", "upi"].includes(refundMethod)) {
                // Refund via Razorpay
                const refund = await razorpay.payments.refund(order.paymentDetails.transactionId, {
                    amount: refundAmount * 100, // Convert to paise
                });

                if (refund.status === "processed") {
                    order.paymentDetails.refundId = refund.id;
                    order.paymentDetails.paymentStatus = "Refunded";
                    await order.save();

                    refundSuccess = true;
                    refundGivenMethod = "Direct Bank";
                }
            }

            // If refund is successful, update the product's refundSuccess and refundGivenMethod
            if (refundSuccess) {
                order.products.forEach(product => {
                    if (productIds.includes(product.productid.toString())) {
                        product.refundSuccess = true;  // Mark refund as successful
                        product.refundGivenMethod = refundGivenMethod; // Store refund method
                    }
                });

                await order.save();
            }
        }

        // Restore stock for canceled products
        for (let product of order.products) {
            if (productIds.includes(product.productid.toString())) {
                const productDoc = await Product.findById(product.productid);
                if (productDoc) {
                    const variant = productDoc.variants.find(v => v.size === product.size && v.color === product.color);
                    if (variant) {
                        variant.stock += product.quantity;
                        await productDoc.save();
                        console.log(`Stock restored for ${productDoc.productName} (${product.size}, ${product.color})`);
                    }
                }
            }
        }

        res.json({ success: true, message: "Product(s) canceled successfully and refund processed if applicable." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// Controller to get order details by orderId
exports.getOrderDetailsProduct = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find the order and populate customer and product details
        const order = await Order.findById(orderId)
            .populate("customerId", "name email") 
            .populate("products.productid", "name image price");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Ensure `paymentDetails` is included in the response
        res.status(200).json({ 
            success: true, 
            order: {
                _id: order._id,
                customerId: order.customerId,
                products: order.products,
                paymentDetails: order.paymentDetails || { method: "" } // Ensure paymentDetails is not undefined
            }
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



// Fetch all orders with customer names
exports.orderManage = async (req, res) => {
    try {
        let { page = 1, pageSize = 10, dateFilter, statusFilter } = req.query; 
        page = parseInt(page);
        pageSize = parseInt(pageSize);

        const filter = {};

        // Apply date filter
        if (dateFilter && dateFilter !== "all") {
            const today = new Date();
            let startDate;

            switch (dateFilter) {
                case "today":
                    startDate = new Date(today.setHours(0, 0, 0, 0));
                    filter.orderDate = { $gte: startDate };
                    break;
                case "last7days":
                    startDate = new Date(today.setDate(today.getDate() - 7));
                    filter.orderDate = { $gte: startDate };
                    break;
                case "last1month":
                    startDate = new Date(today.setMonth(today.getMonth() - 1));
                    filter.orderDate = { $gte: startDate };
                    break;
                case "last6months":
                    startDate = new Date(today.setMonth(today.getMonth() - 6));
                    filter.orderDate = { $gte: startDate };
                    break;
                case "last1year":
                    startDate = new Date(today.setFullYear(today.getFullYear() - 1));
                    filter.orderDate = { $gte: startDate };
                    break;
            }
        }

        // Apply order status filter
        if (statusFilter) {
            filter.status = statusFilter;
        }

        // Count total orders matching filters
        const totalOrders = await Order.countDocuments(filter);

        // Fetch paginated orders
        const orders = await Order.find(filter)
            .sort({ orderDate: -1 }) // Latest orders first
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();

        // Fetch customer details
        const customerIds = orders.map(order => order.customerId);
        const users = await User.find({ _id: { $in: customerIds } })
            .select('_id fname lname')
            .lean();

        // Map user names to orders
        const ordersWithUsernames = orders.map(order => {
            const user = users.find(user => user._id.toString() === order.customerId.toString());
            return { 
                ...order, 
                customerName: user ? `${user.fname} ${user.lname}` : 'Unknown'  
            };
        });

        res.render("orderManagement", { 
            orders: ordersWithUsernames,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / pageSize),
            dateFilter,
            statusFilter
        });

    } catch (error) {
        console.error("Error in order management:", error);
        res.status(500).send("Server Error");
    }
};


// Update order status
exports.orderStatus= async (req, res) => {
    try {
        const { status } = req.body;
        const { orderId } = req.params;

        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, message: 'Order status updated', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getOrderDetailsAdmin = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId, customerId: req.session.userId })
            .populate("products.productid")
            .lean();

        if (!order) return res.status(404).send("Order not found");

        let updatedTotal = order.orderSummary.total;
        let updatedSubtotal = order.orderSummary.subtotal;
        let totalRefundAmount = 0;
        const productsWithDetails = order.products.map(item => {
            const product = item.productid;

            if (!product) {
                console.error("Product not found for item:", item);
                return null; // Skip null product items
            }

            let productStatus = order.status;

// Check for order cancellation
if (item.isDelete) {
    productStatus = "Cancelled";
}

// Check for returns after delivery
if (order.status === "Delivered" && item.return_cancel?.returnRequested) {
    productStatus = "Returned";
    if (item.return_cancel.returnInitiated && item.return_cancel.returnStatus === "Accepted") {
        totalRefundAmount += item.discountedPrice; // Add discounted price to refund amount
    }
}

// Refund message logic
let refundMessage = "";

// Case 1: Order was deleted (Cancelled) 
if (item.isDelete) {
    if (item.refundSuccess) {
        refundMessage = `Refunded via ${item.refundGivenMethod}`;
    } else {
        refundMessage = "Refund Pending";
    }
}
// Case 2: Order was Delivered and a return was requested
else if (order.status === "Delivered" && item.return_cancel?.returnRequested) {
    if (item.return_cancel?.returnStatus === "Accepted") {
        
        refundMessage =  `Refunded via ${item.return_cancel.refundMethod}` ;
            
    } else if (item.return_cancel?.returnStatus === "Pending") {
        refundMessage = "Return request pending approval";
    } else {
        refundMessage = "Return initiated, waiting for update";
    }
}
// Case 3: No cancellation or return request (default case)
else {
    refundMessage = "";
}


            return {
                productid: product._id,
                name: product.productName || "Unknown Product",
                description: product.description || "No description available",
                brand: product.brand || "Unknown Brand",
                productDetails: product.productDetails || "No details available",
                sellerDetails: product.sellerDetails || "Seller info not available",
                images: product.imageUrls?.length ? product.imageUrls[0] : ["/images/default.jpg"], 
                color: item.color,
                size: item.size,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                discountedPrice: item.discountedPrice.toFixed(2),
                totalPrice: item.totalPrice,
                finalDiscount: item.finalDiscount,
                productStatus,
                refundMessage,
                isDelete: item.isDelete,
                return_cancel:item.return_cancel
            };
        }).filter(Boolean);

        const allOrders = {
            ...order,
            products: productsWithDetails,
            totalRefundAmount,
            orderStatusMessage: order.status === "Pending" ? "Your order is pending."
                : order.status === "Cancelled" ? "Your order has been cancelled."
                : order.status === "Delivered" && order.refund ? `Order delivered. Refund processed via ${order.refundMethod}.`
                : "Your order has been delivered.",
            orderSummary: {
                shippingFee: order.orderSummary.shippingFee,
                shippingMethod: order.orderSummary.shippingMethod,
                subtotal: updatedSubtotal,
                discount: order.orderSummary.discount,
                couponDiscount: order.orderSummary.couponDiscount,
                total: updatedTotal
            }
        };

        // Render the orders page with only the selected order
        res.render("orderDetailAdmin", {  allOrders });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Server Error");
    }
};


exports.returnProduct = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId);
        res.json({ products: order.products });
    } catch (error) {
        res.status(500).json({ error: "Error fetching order products." });
    }
};
exports.returnReason = async (req, res) => {
    const { orderId, products, reason, refundMethod } = req.body; // Fixed variable name
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        console.log("Product IDs in DB:", order.products.map(p => p.productid));
        console.log("Selected Product IDs:", products);

        // Ensure correct ID format
        const selectedProductIds = products.map(id => id.toString());

        // Update return details for each selected product
        order.products.forEach((product) => {
            if (selectedProductIds.includes(product.productid.toString())) {
                product.return_cancel = {
                    cancelRequested: true,
                    returnRequested: true,
                    returnStatus: "Pending",
                    returnReason: reason,
                    refundMethod: refundMethod,
                    returnInitiated: false
                };
            }
        });

        // Save updated order
        await order.save();

        res.json({ success: true });
    } catch (error) {
        console.error("Error processing return request:", error);
        res.status(500).json({ error: "Error processing return request." });
    }
};

exports.returnInitiated = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: "Invalid Order ID" });
        }

        console.log("Searching order with ID:", orderId);

        const order = await Order.findById(orderId);

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        let totalRefundAmount = 0;
        let refundMethod = null;
        let userId = order.customerId;

        let productUpdated = false;

        order.products.forEach((product, index) => {
            console.log(`Checking product ${index + 1}:`, product.return_cancel);

            if (product.return_cancel?.cancelRequested == true &&
                product.return_cancel?.returnRequested == true &&
                product.return_cancel?.returnInitiated == false) {
                
                console.log("Updating return status for product:", product._id);

                product.return_cancel.returnInitiated = true;
                product.return_cancel.returnStatus = "Accepted";
                totalRefundAmount += product.discountedPrice;
                refundMethod = product.return_cancel.refundMethod;

                productUpdated = true;
            }
        });

        if (!productUpdated) {
            return res.json({ success: false, message: "No products found for return initiation." });
        }

        order.markModified("products"); // Ensure nested objects are updated
        await order.save();
        console.log("Order successfully updated!");

        if (refundMethod === "Wallet") {
            try {
                let wallet = await Wallet.findOne({ userId: new mongoose.Types.ObjectId(userId) });

                if (!wallet) {
                    console.log("No existing wallet found, creating a new one.");
                    wallet = new Wallet({ userId, balance: 0, transactions: [] });
                }

                console.log(`Adding refund amount: ${totalRefundAmount} to wallet`);
                wallet.balance += totalRefundAmount;

                wallet.transactions.push({
                    transactionType: "credit",
                    amount: totalRefundAmount,
                    description: "Refund for returned items"
                });

                await wallet.save();
                console.log("Wallet successfully updated!");

            } catch (walletError) {
                console.error("Wallet update failed:", walletError);
            }
        }

        return res.json({ success: true, message: "Return accepted and refund processed" });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
const moment = require("moment");

exports.returnPage= async (req, res) => {
    try {
        const { filter } = req.query; // Get time filter from request

        let dateFilter = {};
        const now = moment(); // Current date

        if (filter === "today") {
            dateFilter = {
                orderDate: {
                    $gte: now.startOf("day").toDate(),
                    $lte: now.endOf("day").toDate(),
                },
            };
        } else if (filter === "last_month") {
            dateFilter = {
                orderDate: {
                    $gte: now.subtract(1, "months").startOf("day").toDate(),
                },
            };
        }

        // Fetch orders where cancelRequested is true
        const orders = await Order.find({
            "return_cancel.cancelRequested": true,
            ...dateFilter, // Apply time filter
        }).lean();

        // Send filtered data to EJS
        res.render("return", { orders, filter });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};



const puppeteer = require("puppeteer");

exports.getInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).lean();
        if (!order) return res.status(404).send("Order not found");

        // Fetch all product details in parallel
        const productIds = order.products.map(product => product.productid);
        const productsDetails = await Product.find({ _id: { $in: productIds } }).select("productName").lean();

        // Create a map of productId → productName
        const productMap = {};
        productsDetails.forEach(product => {
            productMap[product._id.toString()] = product.productName;
        });

        // Attach product names to order products
        order.products.forEach(product => {
            product.productName = productMap[product.productid.toString()] || "Unknown Product";
        });

        const isPdf = req.query.pdf === "true"; // Check if it's for PDF

        res.render("invoice", { order, isPdf });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};


exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).lean();
        if (!order) return res.status(404).send("Order not found");

        const browser = await puppeteer.launch({ headless: "new" }); // Run in headless mode
        const page = await browser.newPage();

        const invoiceUrl = `http://localhost:3000/product/invoice/${orderId}?pdf=true`;
        await page.goto(invoiceUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Debug: Take a screenshot to verify page rendering
        await page.screenshot({ path: "invoice_debug.png" });

        // Generate PDF
        const pdfBuffer = await page.pdf({ format: "A4" });

        await browser.close();

        // Validate PDF before sending
        if (!pdfBuffer || pdfBuffer.length === 0) {
            console.error("Generated PDF is empty!");
            return res.status(500).send("Failed to generate PDF");
        }

        // Set response headers correctly
        res.setHeader("Content-Disposition", `attachment; filename=invoice_${orderId}.pdf`);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", pdfBuffer.length);

        res.end(pdfBuffer);
    } catch (error) {
        console.error("Error generating invoice PDF:", error);
        res.status(500).send("Internal Server Error");
    }
};



