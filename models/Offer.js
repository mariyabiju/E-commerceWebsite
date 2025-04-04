
const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
    offerName: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['category', 'product'], required: true },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    filteredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    offerType: { type: String, enum: ['percentage', 'value'], required: true },
    offerValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted:{ type: Boolean, default: true },
}, { timestamps: true });


// Check for expired offers every 1 hour
setInterval(async () => {
    try {
        const expiredOffers = await Offer.updateMany(
            { endDate: { $lt: new Date() }, isActive: true },
            { $set: { isActive: false } }
        );
        console.log(`Updated ${expiredOffers.modifiedCount} expired offers.`);
    } catch (error) {
        console.error("Error updating expired offers:", error);
    }
}, 3600000); // Runs every hour

module.exports = mongoose.model("Offer", OfferSchema);