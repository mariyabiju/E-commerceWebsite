const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
        {
            productid: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
            color: String,
            size: String,
            pricePerUnit: Number,
            quantity: Number,
            totalPrice: Number,
            discountedPrice:Number,
            finalDiscount:Number
        }
    ],
}, { timestamps: true });


module.exports = mongoose.model("Cart", cartSchema);


