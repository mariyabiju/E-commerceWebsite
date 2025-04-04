const Review = require('../models/Review');
// const Order = require('../models/Order');

// Submit Review
exports.submitReview = async (req, res) => {
    const { rating, reviewText, productId } = req.body;
    const userId = req.session.userId;

    // Check if user has ordered the product
    const hasOrdered = await Order.findOne({ userId, productId });
    if (!hasOrdered) {
        req.flash('error', 'You must purchase this product before reviewing.');
        return res.redirect('/product/');
    }

    // Save review in database
    const review = new Review({ userId, productId, rating, reviewText });
    await review.save();
    
    req.flash('success', 'Review submitted successfully!');
    res.redirect('back');
};

// Check Login Status
exports.checkLogin = (req, res) => {
    if (req.session.userId) {
        return res.json({ loggedIn: true });
    }
    return res.json({ loggedIn: false });
};

// Get Rating Data
exports.getRatingData = async (req, res) => {
    const totalReviews = await Review.countDocuments();
    const ratings = await Review.aggregate([
        { $group: { _id: "$rating", count: { $sum: 1 } } }
    ]);

    let ratingData = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };

    ratings.forEach(r => {
        const percentage = (r.count / totalReviews) * 100;
        if (r._id === 5) ratingData.fiveStar = percentage;
        if (r._id === 4) ratingData.fourStar = percentage;
        if (r._id === 3) ratingData.threeStar = percentage;
        if (r._id === 2) ratingData.twoStar = percentage;
        if (r._id === 1) ratingData.oneStar = percentage;
    });

    res.json(ratingData);
};

