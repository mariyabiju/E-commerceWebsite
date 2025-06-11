const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const adminController = require('../controllers/adminController');
const Product = require("../models/Product")
const Category = require("../models/Category");
const Banner = require("../models/Banner");
const offerController = require('../controllers/offerController');
const couponController = require('../controllers/couponController');
const reviewController = require('../controllers/reviewController');
const cartController = require('../controllers/cartController');

// Route for fetching products

const categoryController = require("../controllers/categoryController");


const productController = require("../controllers/productController"); 

router.get('/home', productController.getHomeData); 
//cart
router.get('/cartpage', cartController.getCartItems);
router.get("/cart/count" , cartController.getCartCount);
router.post("/add-to-cart", cartController.addToCart);
router.patch("/update-cart",cartController.updateCart);
router.patch("/user/update-default-address",cartController.updateDefaultAddress )
router.get('/checkout', cartController.getCheckoutPage);
router.post("/wishlist/add/:cartItemId",cartController.wishlistCart);
router.delete("/cart/remove/:productId",cartController.removeCart);
router.get("/cart/check-stock", cartController.checkStockAvailability);
router.get("/get-address/:addressId", cartController.getAddressById);
router.post("/place-order", cartController.placeOrder );

// Order history page with filters
router.get("/orders", cartController.getOrders);

// Order details page
router.get("/order/:id", cartController.getOrderDetails);
router.post("/cancel-order/:orderId",cartController.cancelOrder);

// Admin: Update order status
router.post("/order/:id/status", cartController.updateOrderStatus);
router.post('/cancel-product',cartController.cancelProduct);
router.get("/order-details/:orderId", cartController.getOrderDetailsProduct);

router.get("/get-order-products/:orderId" ,cartController.returnProduct);
router.post("/request-return",cartController.returnReason);
router.get("/return/returnsPage",cartController.returnPage);



router.get("/wishlist", cartController.getWishlist);
router.post("/addToWishlist", cartController.addToWishlist);
router.post("/wishlist/updateproducts", productController.productToWishlist);
router.delete("/removewishlist", productController.removeFromWishlist);


router.get('/search', productController.getProductsFilter);
router.get('/filter', productController.getProductsFilter); 
router.get('/:id', productController.productDetails); 

const uploadMiddleware = require("../middleware/uploadMiddleware");

router.post("/submitreview", uploadMiddleware.uploadreview, reviewController.reviewsubmission);

router.post("/submit-review", productController. submitReview);

router.get("/invoice/:orderId", cartController.getInvoice);
router.get("/invoice/download/:orderId", cartController.downloadInvoice);

router.get("/category/:categoryId", productController.getProductsFilter);
router.get("/brand/:brandName",productController.getProductsFilter);


// Route to handle the filter submission
router.get('/filter', productController.getProductsFilter);


router.get('/offer/:offerId' , productController.bannerProductFilter);

router.get("/refer/referral", couponController.getReferralDetails);
router.post("/refer/apply-referral", couponController.applyReferralCode);



// Route to check login status
router.get('/check-login', reviewController.checkLogin);

// Route to get rating data
router.get('/get-rating-data', reviewController.getRatingData);



module.exports = router;


