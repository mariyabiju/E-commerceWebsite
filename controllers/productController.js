const bcrypt = require('bcrypt');//product
const Product = require("../models/Product"); // Import Product model
const Category = require("../models/Category");
const Banner = require('../models/Banner');
const Offer = require('../models/Offer');
const User = require('../models/User');
const Coupon = require("../models/Coupons"); 
const Order = require("../models/Order");
const Rating = require("../models/Review");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const path = require('path');
const { applyDiscounts } = require("../models/Product");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");


exports.getHomeData = async (req, res) => {
    try {
        // Fetch categories and products
        const products = await Product.find({ isDeleted: false }) // Filter out soft-deleted products
    .populate({
        path: 'category',
        match: { isDeleted: false } 
    }).sort({ createdAt: -1 }).limit(9);
    const filteredproducts = products.filter(product => product.category);
        const categories = await Category.find({ isDeleted: false }); // Fetch active categories
        const banners = await Banner.find().populate('offerId'); // Fetch all banners
        // Check if the user has placed an order
        let showNewUserCoupon = [];
        if (req.session.userId) { // Check if user is logged in using session
            const user = await User.findById(req.session.userId); // Fetch user details

            const userOrders = await Order.find({ customerId: req.session.userId });

            if (userOrders.length === 0) { // New user check
                const newUserCoupon = await Coupon.findOne({ code: "NEWUSER", isActive: true });

                if (newUserCoupon) {
                    showNewUserCoupon.push({
                        name: newUserCoupon.code,
                        discount: newUserCoupon.discountValue,
                    });
                }
            }
        }



        // Fetch the top 8 products for hot deals
        const hotDeals = await Product.find().sort({ finalDiscount: -1 }).limit(8);

        // Calculate date range for limited-time deals (today to 10 days later)
        const today = new Date();
        const tenDaysLater = new Date();
        tenDaysLater.setDate(today.getDate() + 10);

        // Fetch active offers ending within 10 days
        const limitedTimeOffers = await Offer.find({
            endDate: { $gte: today, $lte: tenDaysLater },
            isActive: true
        }).populate("filteredProducts");

        // Extract product IDs from these offers into an array
        const limitedOfferProductIds = limitedTimeOffers.flatMap(offer => 
            offer.filteredProducts.map(product => product._id.toString())
        );

        console.log("Limited Time Offer Product IDs:", limitedOfferProductIds); // Debugging
        const successMsg = req.session.successMsg;
        delete req.session.successMsg; // Remove it after displaying
       // Pass hotDeals and the limitedOfferProductIds array to the EJS template
       res.render("home_user", { products:filteredproducts,  showNewUserCoupon, hotDeals, categories, banners, limitedOfferProductIds ,successMsg});


    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
    
};

// Get paginated products
exports.getProducts = async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.admin) {
            return res.redirect("/admin/login"); // Redirect if not logged in
        }

        let page = parseInt(req.query.page) || 1;
        let limit = 10;
        let skip = (page - 1) * limit;

        // Fetch products with category names using .populate()
        let products = await Product.find()
            .populate("category", "name") // Populate category name
            .sort({ createdAt: -1 }) // Sort by latest products
            .skip(skip)
            .limit(limit);

        let totalProducts = await Product.countDocuments();
        let totalPages = Math.ceil(totalProducts / limit);

        res.render("productList", { 
            products, 
            totalPages, 
            currentPage: page 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// Toggle Product Delete/Restore
exports.toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        // Toggle isDeleted
        product.isDeleted = !product.isDeleted;
        await product.save();

        res.redirect("/admin/products"); // Redirect to product management page
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating product status");
    }
};
exports.editProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate("category"); // Populate category details
        const categories = await Category.find(); // Fetch all categories

        if (!product) {
            return res.status(404).send("Product not found");
        }

        res.render("editProduct", { product, categories }); // Render edit page with populated data
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading product");
    }
};



// Product add controller function

// Set storage engine for multer


const { upload } = require("../middleware/uploadMiddleware");

exports.getProductsFilter = async (req, res) => {
    try {
        // Get filters from query parameters
        const searchQuery =  req.query.q ? String(req.query.q).trim() : "";
        const categoryIds = Array.isArray(req.query.category) ? req.query.category : (req.query.category ? [req.query.category] : []);
        const brandName = req.params.brandName ? decodeURIComponent(req.params.brandName) : null;
        const offerId = req.params.offerId ? req.params.offerId.trim() : null;
        const offer = offerId ? await Offer.findById(offerId) : null;

        // Handle price range (split only if price is a single value)

        const price = req.query.price ? Array.isArray(req.query.price) ? req.query.price : [req.query.price] : [];
        
        const size = Array.isArray(req.query.size) ? req.query.size : (req.query.size ? [req.query.size] : []);
        const colorSelected = Array.isArray(req.query.color) ? req.query.color : (req.query.color ? [req.query.color] : []);
        const sortOption = req.query.sort || 'priceLow';


        const filterTags = req.query.tag
            ? Array.isArray(req.query.tag)
                ? req.query.tag
                : [req.query.tag]
            : [];
        // Pagination settings
        const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        // Build the filter query
        const filterQuery = {};

        // Filter by category
        if (categoryIds.length > 0 && categoryIds[0] !== 'all') {
            filterQuery.category = { $in: categoryIds };
        }

        // Filter by brand
        if (brandName) {
            filterQuery.brand = brandName;
        }

        if (filterTags.length > 0 && filterTags[0] !== 'all') {
            filterQuery.category = { $in: filterTags };  // Assuming 'category' is your DB field
        }
        if (searchQuery) {
            filterQuery.$or = [];
        
            // Product Name
            if (Product.schema.paths.productName.instance === "String") {
                filterQuery.$or.push({ productName: { $regex: searchQuery, $options: "i" } });
            }
        
            // Brand
            if (Product.schema.paths.brand) {
                if (Product.schema.paths.brand.instance === "Array") {
                    filterQuery.$or.push({ brand: { $elemMatch: { $regex: searchQuery, $options: "i" } } });
                } else {
                    filterQuery.$or.push({ brand: { $regex: searchQuery, $options: "i" } });
                }
            }
        
            // Tags (Array)
            if (Product.schema.paths.tags && Product.schema.paths.tags.instance === "Array") {
                filterQuery.$or.push({ tags: { $regex: searchQuery, $options: "i" } });
            }
        
            // Variants (Array of Objects)
            if (Product.schema.paths.variants && Array.isArray(Product.schema.paths.variants.options.type)) {
                filterQuery.$or.push({
                    variants: { $elemMatch: { color: { $regex: searchQuery, $options: "i" } } }
                });
            }
        }
        
// Filter by price if price ranges exist
if (price.length > 0) {
    const priceRanges = price.map(range => {
        const [minPrice, maxPrice] = range.split('-'); // Assuming price is passed as "min-max" (e.g., "0-50")
        
        // Make sure both minPrice and maxPrice are valid numbers
        const min = Number(minPrice);
        const max = Number(maxPrice);
        
        if (isNaN(min) || isNaN(max)) {
            // Skip invalid price ranges
            return null;
        }
        
        return {
            price: { $gte: min, $lte: max }
        };
    }).filter(Boolean); // Remove any invalid price ranges
    
    if (priceRanges.length > 0) {
        // If there are valid price ranges, apply the $or condition
        filterQuery.$or = priceRanges;
    }
}


        // Filter by size
        if (size.length > 0) {
            filterQuery["variants.size"] = { $in: size };
        }

        // Filter by color
        if (colorSelected.length > 0) {
            filterQuery["variants.color"] = { $in: colorSelected };
        }

        // Sort options
        let sortQuery = {};
        if (sortOption === 'priceLow') {
            sortQuery = { discountedPrice: 1 };
        } else if (sortOption === 'priceHigh') {
            sortQuery = { discountedPrice: -1 };
        } else if (sortOption === 'newArrival') {
            sortQuery = { createdAt: -1 };
        } else if (sortOption === 'bestSeller') {
            sortQuery = { soldCount: -1 };
        }

        let wishlistProductIds = []; // Array to store wishlist product IDs

        if (req.session.userId) {
            const userWishlist = await Wishlist.findOne({ userId: req.session.userId });
            wishlistProductIds = userWishlist ? userWishlist.items.map(item => item.productid.toString()) : [];
        }


        // Get the filtered products with pagination
        const filteredProducts = (await Product.find(filterQuery).populate({
            path:'category',
            match:{isDeleted:false}
        })
            .skip(skip)
            .limit(limit)
            .sort(sortQuery)).filter(filteredProduct=>filteredProduct.category)

        // Get the total count of matching products
        const totalProducts = await Product.countDocuments(filterQuery);

        // Fetch all categories and unique colors for filtering
        const categories = await Category.find({isDeleted:false});
        const allProducts = (await Product.find({ isDeleted: false })
        .populate({
            path: 'category',
            match: { isDeleted: false },
        }))
        .filter(product => product.category);
        let allColors = [];

        allProducts.forEach(product => {
            product.variants.forEach(variant => {
                if (variant.color && !allColors.includes(variant.color)) {
                    allColors.push(variant.color);
                }
            });
        });

        allColors.sort(); // Sort color options

        // Render the page with pagination
        res.render("product_display", {
            products: filteredProducts,
            searchQuery: searchQuery,
            categories: categories,
            tagList: await Category.find(),  // Replacing categories with tagList
            selectedTag: filterTags[0] || 'all',  
            filterTags: filterTags,  
            colors: allColors,
            wishlistProductIds,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            offerId,
            offerName: offer ? offer.name : "Offer",
            brandName: brandName,
            categoryId: categoryIds[0] || 'all',  // This is correct
            categoryIds: categoryIds,  // Add this to make it available in EJS
            sortOption: sortOption,
            price: price,
            size: size,
            colorSelected: colorSelected,
        });

    } catch (error) {
        console.error("Error fetching filtered products:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.productToWishlist = async (req, res) => {
    const { productId, addToWishlist } = req.body;
    const userId = req.session.userId; 

    try {
        // Validate productId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid productId" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, items: [] });
        }

        if (addToWishlist) {
            //Ensure product doesn't already exist in wishlist
            const productExists = wishlist.items.some(item => item.productid.toString() === productId);
            if (!productExists) {
                wishlist.items.push({ productid: new mongoose.Types.ObjectId(productId) }); 
            }
        } else {
            // Remove product from wishlist safely
            wishlist.items = wishlist.items.filter(item => item.productid.toString() !== productId);
        }

        await wishlist.save();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating wishlist" });
    }
};


// Controller to fetch product details
exports.productDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        // Validate ObjectId before querying MongoDB
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send("Invalid product ID");
        }
        const product = await Product.findById(productId).populate("category");
       
        // Fetch Ratings
        const ratings = await Rating.find({ productId });

        // Calculate Rating Breakdown
        let ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        ratings.forEach((r) => ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1);

        // Calculate Average Rating
        const totalRatings = ratings.length;
        const averageRating = totalRatings
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings).toFixed(1)
            : 0;

            let userRating = null;
            if (req.session.userId) {
                const userGivenRating = await Rating.findOne({ 
                    productId, 
                    userId: req.session.userId 
                });
                userRating = userGivenRating ? userGivenRating.rating : null;
            }
        let showNewUserCoupon = []; // Ensure it's an array

        if (req.session.userId) { // Check if user is logged in
            const user = await User.findById(req.session.userId);
            const userOrders = await Order.find({ customerId: req.session.userId });

            if (userOrders.length === 0) { // Check if it's the user's first order
                const newUserCoupon = await Coupon.findOne({ code: "NEWUSER", isActive: true });
                if (newUserCoupon) {
                    showNewUserCoupon = [ // Ensure it's a proper array of objects
                        {
                            code: newUserCoupon.code,
                            discountValue: newUserCoupon.discountValue,
                            description: newUserCoupon.description
                        }
                    ];
                }
            }
        }
        let wishlistProductIds = []; // Array to store wishlist product IDs

        if (req.session.userId) {
            const userWishlist = await Wishlist.findOne({ userId: req.session.userId });
            wishlistProductIds = userWishlist ? userWishlist.items.map(item => item.productid.toString()) : [];
        }
        // Fetch available active coupons excluding the "newUser" coupon
        let availableCoupons = await Coupon.find({ 
            isActive: true, 
            createdBy: { $ne: "newUser" } 
        });

        // Make sure both are arrays and correctly concatenated
        let allCoupons = [...availableCoupons, ...showNewUserCoupon]; 

        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }
          // Fetch the top 8 products for hot deals
          const hotDeals = await Product.find().sort({ finalDiscount: -1 }).limit(8);

          // **Create Breadcrumbs Data**
          const breadcrumbs = [
            { name: "Home", url: "/product/home" },
            { 
                name: product.category?.name || "Unknown Category", 
                url: `/product/category/${product.category?._id}?category=${product.category?._id}` 
            }, // Category Link
        ];
        if (product.brand) {
            breadcrumbs.push({ 
                name: `${product.brand}`, 
                url: `/product/brand/${encodeURIComponent(product.brand)}`
            });
        }
        
        // Always add product name at the end
        breadcrumbs.push({ name: product.name, url: "#" });
        

          // Fetch all products and randomly select 6 for "You May Also Like"
          const allProducts = await Product.find();
          const randomProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, 6);
  
          const today = new Date();
          const tenDaysLater = new Date();
          tenDaysLater.setDate(today.getDate() + 10);
  
          const limitedTimeOffers = await Offer.find({
              endDate: { $gte: today, $lte: tenDaysLater },
              isActive: true
          }).populate("filteredProducts");
  
          const limitedOfferProductIds = limitedTimeOffers.flatMap(offer => 
              offer.filteredProducts.map(product => product._id.toString())
          );
  
          res.render("productDetails", { product, hotDeals, limitedOfferProductIds,userRating , ratingCounts, averageRating, totalRatings,randomProducts, breadcrumbs , allCoupons, 
            showNewUserCoupon, wishlistProductIds , isProductDeleted: product.isDeleted, isLoggedIn: req.session.userId ? true : false });
        
    } 
    catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Server Error' });
    }
};

exports.bannerProductFilter = async (req, res) => {
    try {
        const { offerId } = req.params;
        const offer = await Offer.findById(offerId).populate('filteredProducts');

        if (!offer) {
            return res.status(404).render('error', { message: 'Offer not found' });
        }

        // Fetch categories and colors for filters
        const categories = await Category.find({isDeleted:false});
        const colors = await Product.distinct("color"); 

        const brandName = req.params.brandName ? decodeURIComponent(req.params.brandName) : null;
        let wishlistProductIds = []; // Array to store wishlist product IDs

        if (req.session.userId) {
            const userWishlist = await Wishlist.findOne({ userId: req.session.userId });
            wishlistProductIds = userWishlist ? userWishlist.items.map(item => item.productid.toString()) : [];
        }
        // Ensure categoryIds is always passed to the view
        const categoryIds = [];

        res.render('product_display', { 
            products: offer.filteredProducts, 
            categories,
            categoryIds,  // Pass an empty array if no category filter is applied
            categoryId: "all",
            price: [],
            size: [],
            colors,
            wishlistProductIds,
            brandName,
            offerId: offer._id,
            offerName: offer.offerName,
            colorSelected: [],
            sortOption: "priceLow",
            currentPage: 1,
            totalPages: 1
        });
    } catch (error) {
        console.error('Error fetching offer products:', error);
        res.status(500).render('error', { message: 'Error fetching products' });
    }
};


exports.submitReview = async (req, res) => {
    try {
        const { productId, rating } = req.body;

        // Check if userId is present in session
        const userId = req.session.userId;  // Set userId from session

        if (!userId) {
            return res.status(401).json({ message: "Login required to submit a review." });
        }

        if (!productId || !rating) {
            return res.status(400).json({ message: "Product ID and rating are required." });
        }

        // Check if the user has already rated this product
        const existingReview = await Rating.findOne({ productId, userId });

        if (existingReview) {
            // Update existing rating instead of duplicating
            existingReview.rating = rating;
            await existingReview.save();
            return res.json({ message: "Review updated successfully!" });
        } else {
            // Create a new review
            const newReview = new Rating({ productId, userId, rating });
            await newReview.save();
            return res.json({ message: "Review submitted successfully!" });
        }
    } catch (error) {
        console.error("Error submitting review:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


