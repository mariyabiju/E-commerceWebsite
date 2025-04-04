const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    emailId: { type: String, sparse: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    birthDate: { type: Date, required: true },
    phoneNumber: { type: String, sparse: true },
    hashedPassword: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    isBlock: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    profilePic:{type: String,default: ""},
    //  Referral system fields
    referralCode: { type: String, unique: true }, // Unique referral code for each user
    referredBy: { type: String, default: null }, // Stores the referral code used during signup
    RewardGive: { type: Boolean, default: false }
  },
  { timestamps: true } ,{ strict: false } 
);

//  Function to generate a unique referral code
const generateReferralCode = async () => {
  let newReferralCode;
  let isUnique = false;

  while (!isUnique) {
    newReferralCode = `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const existingUser = await mongoose.model("User").findOne({ referralCode: newReferralCode });

    if (!existingUser) {
      isUnique = true;
    }
  }

  return newReferralCode;
};

userSchema.pre("save", async function (next) {

  // Generate referral code only when it's not set
  if (!this.referralCode) {
      this.referralCode = await generateReferralCode();
  }

  next();
});

module.exports = mongoose.model("User", userSchema);
