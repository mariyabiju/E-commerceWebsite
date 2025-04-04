const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    totalStock: { type: Number, default: 0 },   
    totalSales: { type: Number, default: 0 }   
});

module.exports = mongoose.model("Category", categorySchema);
