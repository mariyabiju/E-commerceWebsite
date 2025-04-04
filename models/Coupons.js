const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    description:{type: String,required: true},
    discountType: { type: String, required: true },
    discountValue: { type: Number, required: true },
    minPurchase: { type: Number, default: 0 }, 
    validFrom: { type: Date, default: null }, 
    validTo: { type: Date, default: null }, 
    isActive: { type: Boolean, default: true },
    isDelete: { type: Boolean, default: true }, 
    createdBy: { type: String, enum: ["admin", "referral", "newUser"], required: true },

    // Tracks which user used the referral code
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null } ,
     // Who gets the reward for referring
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

     // Status to track if referrer reward is given
    referrerRewardGiven: { type: Boolean, default: false }

});

module.exports = mongoose.model("Coupon", couponSchema);

