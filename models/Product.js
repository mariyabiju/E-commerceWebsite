const mongoose = require("mongoose");
const Offer = require("../models/Offer");

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [{ type: String }],
    price: { type: Number, required: true },
    discountedPrice: { type: Number, default: null }, // Store final price after discount
    finalDiscount: { type: Number, default: 0 }, // Store total discount percentage
    brand: { type: String },
    productDetails: { type: String },
    isDeleted: { type: Boolean, default: false },
    sellerDetails: { type: String },
    imageUrls: [{ type: String }],  
    sizeChart: { type: String }, 
    variants: [
        {
            size: { type: String },
            color: { type: String },
            stock: { type: Number, required: true }
        }
    ],
    ratings: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
            rating: Number, // Rating value (1-5)
            comment: String, // Optional comment
            createdAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

/**
 * Function to apply the best discount to a product.
 * Ensures only the highest discount (percentage or fixed) is applied.
 */
const applyDiscounts = async (product) => {
    const activeOffers = await Offer.find({
        isActive: true,
        $or: [
            { type: "product", filteredProducts: product._id },
            { type: "category", category_id: product.category }
        ],
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    });

    if (activeOffers.length === 0) {
        return {
            discountedPrice: product.price,
            finalDiscount: 0
        };
    }

    let maxPercentageDiscount = 0;
    let maxValueDiscount = 0;

    activeOffers.forEach(offer => {
        if (offer.offerType === "percentage") {
            maxPercentageDiscount = Math.max(maxPercentageDiscount, offer.offerValue);
        } else if (offer.offerType === "value") {
            maxValueDiscount = Math.max(maxValueDiscount, offer.offerValue);
        }
    });

    // Calculate discounted price for both types of discounts
    let percentageDiscountAmount = (maxPercentageDiscount / 100) * product.price;
    let bestDiscount = Math.max(percentageDiscountAmount, maxValueDiscount);
    let finalPrice = Math.max(product.price - bestDiscount, 0); // Ensure non-negative price

    return {
        discountedPrice: Math.round(finalPrice),
        finalDiscount: Math.round((bestDiscount / product.price) * 100) // Convert back to percentage
    };
};

// Middleware: Update Discounts Before Saving Product
productSchema.pre("save", async function (next) {
    if (this.isModified("price") || this.isNew) {  
        const { discountedPrice, finalDiscount } = await applyDiscounts(this);
        this.discountedPrice = discountedPrice;
        this.finalDiscount = finalDiscount;
    }
    next();
});

// Model Definition
const Product = mongoose.model("Product", productSchema);


module.exports = Product;
module.exports.applyDiscounts = applyDiscounts;



