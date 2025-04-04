const Category = require("../models/Category");
const Product = require("../models/Product");
const { applyDiscounts } = require("../models/Product");

const Offer = require("../models/Offer");
const Banner = require('../models/Banner');


const { upload } = require("../middleware/uploadMiddleware");

exports.getOffer = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false });
        let products = await Product.find({}, "variants.color productName category createdAt price discountedPrice finalDiscount");
        
        const page = parseInt(req.query.page) || 1;  // Current page
        const limit = 5; // Offers per page
        const skip = (page - 1) * limit;
        const totalOffers = await Offer.countDocuments();
        const offers = await Offer.find()
        .skip(skip)
        .limit(limit);
        
        // Fetch only "New Arrival" products (added in the last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newArrivals = await Product.find({ createdAt: { $gte: thirtyDaysAgo } });

        // Get unique colors from products
        const colors = new Set();
        for (let product of products) {
            product.variants.forEach(variant => {
                colors.add(variant.color);
            });

            // Apply discounts dynamically to each product
            const { discountedPrice, finalDiscount } = await applyDiscounts(product);
            product.discountedPrice = discountedPrice;
            product.finalDiscount = finalDiscount;

            //  Save updated discount values in the database
            await product.save();  // Ensures discounts are permanently updated
        }

        // Format the date fields before passing to the template
        const formattedOffers = offers.map(offer => ({
            ...offer._doc,  // Spread existing offer data
            validFrom: offer.startDate ? new Date(offer.startDate).toDateString() : "N/A",
            validTo: offer.endDate ? new Date(offer.endDate).toDateString() : "N/A"
        }));
        // Calculate total pages
        const totalPages = Math.ceil(totalOffers / limit);
        res.render("offer", { 
            offers: formattedOffers, 
            categories, 
            products, 
            newArrivals, 
            colors: Array.from(colors) ,
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error("Error fetching categories and products:", error);
        res.status(500).send("Server Error");
    }
};


exports.addOffer = async (req, res) => {
    try {
        const { name, type, category_id, offerType, value,products, validFrom, validTo } = req.body;

        let filteredProducts;
        try {
            if (req.body.filteredProducts) {
                filteredProducts = JSON.parse(req.body.filteredProducts); // Now this will work correctly
                console.log('Received filteredProducts:', filteredProducts);
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
            return res.status(400).json({ error: 'Invalid JSON format in filteredProducts' });
        }

        // Create a new offer object
        const newOffer = new Offer({
            offerName:name,
            type,
            category_id,
            filteredProducts:products, // Ensure it's defined
            offerType,
            offerValue:value,
            startDate:validFrom,
            endDate:validTo
        });

        await newOffer.save();
        
        // Flash a success message and redirect to the offer list page
        req.flash('success', 'Offer created successfully!');
        res.redirect('/admin/offer');
    } catch (error) {
        console.error('Error creating offer:', error);
        req.flash('error', 'Failed to create offer. Please try again.');
        res.redirect('/admin/offer'); // Redirect back to the add-offer page on failure
    }
};


// Get Offer Details for Editing
exports.getOfferDetails = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }
        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: "Error fetching offer details" });
    }
};

// Update Offer
exports.updateOffer = async (req, res) => {
    try {
        const { offerName, type, offerType, offerValue, startDate, endDate } = req.body;

        const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, {
            offerName,
            type,
            offerType,
            offerValue,
            startDate,
            endDate
        }, { new: true });

        if (!updatedOffer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        res.json({ message: "Offer updated successfully", updatedOffer });
    } catch (error) {
        res.status(500).json({ message: "Error updating offer" });
    }
};
exports.toggleOfferStatus = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);

        if (!offer) {
            return res.status(404).json({ message: "Offer not found" });
        }

        // Toggle isDeleted and isActive
        offer.isDeleted = !offer.isDeleted;
        offer.isActive = !offer.isDeleted;

        await offer.save();

        res.json({ 
            message: offer.isDeleted ? "Offer blocked successfully" : "Offer restored successfully", 
            offer 
        });
    } catch (error) {
        res.status(500).json({ message: "Error updating offer status" });
    }
};



exports.getActiveBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).populate('offerId');
        res.json(banners);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching banners' });
    }
};
exports.createBanner = async (req, res) => {
    try {
        const { offerId } = req.body;
        const bannerImage = req.file ? req.file.filename : "default.jpg";
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        const newBanner = new Banner({
            offerId,
            bannerImage,
            startDate: offer.startDate,
            endDate: offer.endDate,
            isActive: true
        });
        await newBanner.save();
        req.flash('success', 'Banner created successfully!');
        res.redirect('/admin/offer');
    } catch (error) {
        console.error('Error creating banner:', error);
        req.flash('error', 'Failed to create banner. Please try again.');
        res.redirect('/admin/offer'); // Redirect back to the add-offer page on failure
    }
};



exports.softDeleteExpiredBanners = async () => {
    try {
        const today = new Date();
        await Banner.updateMany({ endDate: { $lt: today } }, { isActive: false });
        console.log('Expired banners soft deleted.');
    } catch (error) {
        console.error('Error deleting banners:', error);
    }
};
exports.getBannerProducts = async (req, res) => {
    try {
        const { bannerId } = req.params;
        const banner = await Banner.findById(bannerId).populate({
            path: 'offerId',
            populate: { path: 'products' } // Populate products from offer
        });

        if (!banner || !banner.offerId) {
            return res.status(404).json({ error: 'Banner or offer not found' });
        }

        res.json(banner.offerId.products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching banner products' });
    }
};
