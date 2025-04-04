const Coupon = require("../models/Coupons");
const User = require('../models/User');
const Order = require("../models/Order");

exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find(); // Fetch all coupons from the database

        res.render("coupon", { coupons }); // Render the EJS view with coupon data
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).render('error', { message: 'Error fetching coupons' });
    }
};

exports.editCoupon=async (req, res) => {
    await Coupon.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
};

exports.toggleCoupon =  async (req, res) => {
    await Coupon.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive });
    res.json({ success: true });
};

exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        // Toggle delete status
        coupon.isDelete = !coupon.isDelete;
        await coupon.save();

        res.json({ success: true, message: `Coupon ${coupon.isDelete ? "deleted" : "retrieved"} successfully` });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


exports.getCoupon = async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    res.json(coupon);
};


exports.addCoupon = async (req, res) => {
    const { code, discountType, discountValue, minPurchase, validFrom, validTo, userType,description } = req.body;

    try {
        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).send("Coupon code already exists!");
        }

        let couponData = {
            code,
            discountType,
            discountValue,
            description: req.body.description || "No description provided",
            minPurchase: minPurchase || 0,
            isActive: true,
            createdBy: userType
        };

        // Only Admin coupons have a validity period
        if (userType === "admin") {
            couponData.validFrom = validFrom ? new Date(validFrom) : new Date(); 
            couponData.validTo = validTo ? new Date(validTo) : new Date("2099-12-31"); 
        } else {
            couponData.validFrom = new Date();  // Instead of null, set a default date
            couponData.validTo = new Date("2099-12-31"); 
        }

        await Coupon.create(couponData);
        req.flash('success', 'Coupon created successfully!');
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error("Error creating coupon:", error);
        req.flash('error', 'Failed to create coupon. Please try again.');
        res.redirect('/admin/coupons');
    }
};

exports.getMyCoupons = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming user authentication is done
        const coupons = await Coupon.find({ referredUserId: userId, isActive: true });

        res.status(200).json({ coupons });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        res.status(500).json({ error: "Failed to fetch coupons" });
    }
};

exports.applyReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.body;
        const userId = req.session.userId; // Logged-in user ID

        if (!referralCode) {
            return res.json({ status: "error", message: "Please enter a referral code!" });
        }

        // Find the referrer (user who owns the referral code)
        const referrer = await User.findOne({ referralCode: referralCode });

        if (!referrer) {
            return res.json({ status: "error", message: "Invalid referral code!" });
        }

        // Find the current user
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ status: "error", message: "User not found!" });
        }

        // Check if the logged-in user has already used a referral code
        if (user.referredBy) {
            return res.json({ status: "error", message: "You have already used a referral code!" });
        }

        // Check if another user has already used this referral code
        const alreadyUsed = await User.findOne({ referredBy: referralCode });

        if (alreadyUsed) {
            return res.json({ status: "error", message: "This referral code has already been used!" });
        }

        // Save the referral code in the current user's referredBy field
        user.referredBy = referralCode;
        await user.save();

        // Ensure codeGive field exists and set it to true
        await User.findOneAndUpdate(
            { _id: referrer._id },
            { $set: { RewardGive: true } },
            { new: true } // Ensures it returns the updated document
        );
        

        // Reward the referrer with a coupon
        let rewardCoupon = await Coupon.findOne({ code: "REWARD", isDelete: false });

        if (!rewardCoupon) {
            rewardCoupon = new Coupon({
                code: "REWARD",
                discountValue: 10, // Example: 10% discount
                referrerRewardGiven: true,
                isDelete: false
            });
            await rewardCoupon.save();
        }

        return res.json({
            status: "success",
            message: "Referral code applied successfully! You and your referrer received a discount coupon.",
            rewardCoupon
        });

    } catch (error) {
        console.error("Error applying referral code:", error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};





  // Fetch Referral & Coupon Data for Display
  exports.getReferralDetails = async (req, res) => {
    try {
        const userId = req.session.userId; // Get logged-in user ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("User not found");
        }

        // Get the referral code of the logged-in user
        const userReferralCode = user.referralCode;

        let referredCoupon = null;
        let referrerCoupon = null;
        let rewardCoupon = null; // New variable for reward coupon

        // Check if the user has placed an order
        const hasPurchased = await Order.exists({ customerId: userId });

        // If the user has not placed an order, show the referral code entry box
        const showReferralBox = !hasPurchased && !user.referredBy;

        // If the user was referred by someone (used a referral code)
        if (user.referredBy) {
            // Fetch the Referral Coupon details
            referredCoupon = await Coupon.findOne({
                code: "REFERRAL COUPON",
                isDelete: false
            });
        }

        // Check if this user has referred anyone else
        const referredUser = await User.findOne({ referredBy: userReferralCode });

        if (referredUser) {
            // Check if the referred user has placed an order
            const referredUserPurchased = await Order.exists({ customerId: referredUser._id });

            if (referredUserPurchased) {
                // Fetch the Reward Coupon for the referrer
                referrerCoupon = await Coupon.findOne({
                    code: "REWARD",
                    isDelete: false
                });

                // If the Reward Coupon was used before, don't display it again
                if (referrerCoupon && referrerCoupon.referrerRewardGiven) {
                    referrerCoupon = null;
                }
            }
        }

        // If the user has placed their first order, remove the Referral Coupon
        if (hasPurchased && referredCoupon) {
            await Coupon.updateOne({ code: "REFERRAL COUPON" }, { isDelete: true });
            referredCoupon = null; // Ensure it is not displayed
        }

        // **Check if codeGive is true for this user**
        if (user.RewardGive) {
            rewardCoupon = await Coupon.findOne({ code: "REWARD", isDelete: false });
        }

        // Render EJS page with referral details
        res.render("referPg", {
            user,
            userReferralCode,
            showReferralBox,
            referredCoupon,
            referrerCoupon,
            rewardCoupon, // Pass reward coupon to EJS
            hasPurchased
        });

    } catch (error) {
        console.error("Error fetching referral details:", error);
        res.status(500).send("Server error");
    }
};

