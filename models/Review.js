const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, // References the User who wrote the review

    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    }, // References the Product being reviewed

    rating: { 
        type: Number, 
        min: 1, 
        max: 5 
    }, // Rating between 1 to 5

    reviewText: { 
        type: String, 
        trim: true 
    }, // Review content

    reviewImages: [
        {
            type: String // URLs of uploaded images
        }
    ], // Optional images attached to the review

    likes: { 
        type: Number, 
        default: 0 
    }, // Count of likes on the review

    dislikes: { 
        type: Number, 
        default: 0 
    }, // Count of dislikes on the review

    verifiedPurchase: { 
        type: Boolean, 
        default: false 
    }, // Indicates if the review is from a verified buyer

    flagged: { 
        type: Boolean, 
        default: false 
    }, // Indicates if the review is reported for inappropriate content

    replies: [
        {
            userId: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'User' 
            },
            comment: { 
                type: String, 
            },
            createdAt: { 
                type: Date, 
                default: Date.now 
            }
        }
    ], // Nested replies on the review

}, { 
    timestamps: true // Automatically creates createdAt & updatedAt fields
});

module.exports = mongoose.model('Review', reviewSchema);
