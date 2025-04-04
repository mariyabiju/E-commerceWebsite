const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true }, // Reference to Offer
    bannerImage: String,  // Image URL
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true } //Soft delete flag
});

module.exports = mongoose.model('Banner', bannerSchema);
