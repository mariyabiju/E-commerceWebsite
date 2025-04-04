const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["Home", "Work"], required: true },
    city: String,
    country: String,
    houseName: String,
    landmark: String,
    latitude: Number,
    longitude: Number,
    pin: String,
    state: String,
    street: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Address", addressSchema);
