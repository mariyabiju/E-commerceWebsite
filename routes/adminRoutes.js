const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const adminController = require('../controllers/adminController');
const Product = require("../models/Product")
const Category = require("../models/Category");
const authMiddleware = require('../middleware/authMiddleware');


// Routes

router.get("/users",authMiddleware, adminController.getAllUsers);

router.post("/toggle-block/:id", adminController.toggleBlockUser);


// Route for fetching products
const productController = require("../controllers/productController");
const categoryController = require("../controllers/categoryController");
const couponController = require('../controllers/couponController');
const cartController=require('../controllers/cartController');
//const { upload, processImages } = require("../middleware/uploadMiddleware");

// Add product route
//router.post("/products/add", upload, processImages, productController.addProduct);



//Admin login
router.post('/login', adminController.adminLogin);
router.get('/login',adminController.getLogin)






const multer = require("multer");
const path = require("path");

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Ensure 'uploads/' folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const storages = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/uploads/"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const uploads = multer({ storages });

router.post("/products/add", adminController.upload.fields([
    { name: "imageUrls", maxCount: 5 },
    { name: "sizeChart", maxCount: 1 }
]), adminController.addProduct);

router.get("/products", authMiddleware,productController.getProducts);
router.get("/add-product",authMiddleware, async(req, res) => {
    try {
        const categories = await Category.find(); // Fetch categories from database
        res.render("addProduct", { categories }); // Pass categories to EJS
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching products");
    }
    
});
router.get('/products/:id/variants', adminController.getProductVariants);
router.put('/products/:productId/variant/:variantId', adminController.updateVariantStock);
// Toggle product delete/restore
router.get("/toggle-product/:id", productController.toggleProductStatus);
router.get("/edit/:id", productController.editProduct);
router.post("/update/:id", adminController.upload.fields([{ name: "imageUrls", maxCount: 5 }]), adminController.updateProduct);

//category
// Get all categories
router.get("/category",authMiddleware, categoryController.getAllCategories);

// Add category (with image upload)
router.post("/add-category", upload.single("image"), categoryController.addCategory);

router.patch("/edit-category/:id", upload.single("image"), categoryController.editCategory);


// GET delete (soft delete) a category
// Toggle category delete/restore
router.get("/toggle-category/:id", categoryController.toggleCategoryStatus);

const offerController = require("../controllers/offerController");

router.get("/offer", authMiddleware,offerController.getOffer); 
router.post("/add-offer", offerController.addOffer);


// Get Offer Details (for Edit)
router.get("/offers/:id", offerController.getOfferDetails);

// Update Offer
router.patch("/edit-offer/:id", offerController.updateOffer);
router.post("/toggle-offer/:id", offerController.toggleOfferStatus);
 //banner

 router.get('/active-banners', offerController.getActiveBanners);

//  Admin: Create banner (Modal Form)
router.post('/create-banner', upload.single("bannerImage"), offerController.createBanner);

//  Soft delete expired banners
router.put('/delete-expired', offerController.softDeleteExpiredBanners);


//coupon
router.get('/coupons', authMiddleware,couponController.getAllCoupons); 

router.post("/add-coupon",couponController.addCoupon)
router.put("/update-coupon/:id", couponController.editCoupon);
router.put("/toggle-status/:id" , couponController.toggleCoupon);
router.put("/delete-coupon/:id", couponController.deleteCoupon);
router.get("/get-coupon/:id", couponController.getCoupon);


router.get('/ordermanage',cartController.orderManage);
router.put('/orders/:orderId/status',cartController.orderStatus);
router.get('/ordersdetails/:id', cartController.getOrderDetailsAdmin);
router.post("/accept-return",cartController.returnInitiated);



router.get("/dashboard/sales", adminController.getSalesData);

// Route to render the dashboard with sales data
//router.get("/dashboard/sales", adminController.getDashboard);

    //  Get products when clicking on a banner
router.get('/:bannerId/products', offerController.getBannerProducts);

router.get('/sales-report', adminController.getSalesReport);

router.get("/sales/download-pdf",  adminController.downloadPDF);
router.get("/sales/download-excel",  adminController.downloadExcel);
// Export the router
module.exports = router;