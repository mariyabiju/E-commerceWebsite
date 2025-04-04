const User = require('../models/User');  // Import User model
const bcrypt = require('bcrypt');
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const Address = require("../models/Address"); // Address Model
const moment = require("moment"); // Install using: npm install moment

exports.getAllUsers = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 5; 
        let skip = (page - 1) * limit;

        const users = await User.find()
            .populate("addressId") // Populate address details
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        res.render("user_admin", {
            users,
            moment, // Pass moment.js to the template
            currentPage: page,
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};
// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Ensure 'uploads/' folder exists
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
  }
});

exports.upload = multer({ storage: storage });

exports.addProduct = async (req, res) => {
  try {
      const { productName, description, category_id, tags, price, brand, productDetails, sellerDetails, variants, croppedImage } = req.body;

      console.log("Received Variants:", variants);

      let parsedVariants = variants;
      if (typeof variants === "string") {
          try {
              parsedVariants = JSON.parse(variants);
          } catch (error) {
              console.error("Error parsing variants:", error);
          }
      }
      
      let variations = [];
      if (parsedVariants && Array.isArray(parsedVariants.size)) {
          variations = parsedVariants.size.map((size, index) => ({
              size,
              color: parsedVariants.color[index] || "N/A",
              stock: parseInt(parsedVariants.stock[index], 10) || 0
          }));
      }

      // Handle multiple image uploads correctly
      let imageUrls = req.files["imageUrls"] ? req.files["imageUrls"].map(file => file.path) : [];

      // Process cropped image if provided
      if (croppedImage) {
          const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          const imagePath = `uploads/${Date.now()}-cropped.jpg`;

          await sharp(buffer)
              .resize(555, 748) // Resize as needed
              .jpeg({ quality: 100 }) // Optimize quality
              .toFile(imagePath);

          imageUrls.push(imagePath);
      }

      // Save product
      const newProduct = new Product({
          productName,
          description,
          category: new mongoose.Types.ObjectId(category_id),
          tags: tags ? tags.split(",") : [],
          price: parseFloat(price),
          brand,
          productDetails,
          sellerDetails,
          imageUrls, // Store all images including cropped one
          sizeChart: req.files["sizeChart"] ? req.files["sizeChart"][0].path : null,
          variants: variations
      });

      await newProduct.save();
      res.redirect('/admin/products');


  } catch (error) {
      console.error("Error adding product:", error);
      res.redirect('/admin/products');
  }
};
exports.updateProduct = async (req, res) => {
    try {
        console.log("Received update request:", req.body);
        console.log("Files received:", req.files);

        const productId = req.params.id;
        const { productName, description, category_id, price, removedImages, existingImages, croppedImages } = req.body;

        let product = await Product.findById(productId);
        if (!product) {
            console.log("Product not found");
            return res.status(404).json({ message: "Product not found" });
        }

        console.log("Product found:", product);
        
        // Ensure existingImages is an array
        let updatedImageUrls = existingImages ? (Array.isArray(existingImages) ? existingImages : JSON.parse(existingImages)) : [];
        console.log("Updated Image URLs:", updatedImageUrls);

        // Handle Removed Images
        if (removedImages) {
            const removedImageList = JSON.parse(removedImages);
            removedImageList.forEach((img) => {
                const imgPath = path.join(__dirname, "../uploads", path.basename(img));
                if (fs.existsSync(imgPath)) {
                    fs.unlinkSync(imgPath);
                    console.log("Deleted Image:", imgPath);
                }
                updatedImageUrls = updatedImageUrls.filter((url) => url !== img);
            });
        }

        console.log("Final Image List After Removal:", updatedImageUrls);

        // Handle New Image Uploads
        let newImageUrls = req.files?.imageUrls?.map(file => file.path) || [];
        console.log("New Image URLs:", newImageUrls);

        // Process Cropped Images
        if (croppedImages) {
            let croppedImageArray = Array.isArray(croppedImages) ? croppedImages : [croppedImages];

            for (const base64Image of croppedImageArray) {
                if (base64Image.startsWith("data:image")) {
                    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
                    const buffer = Buffer.from(base64Data, "base64");
                    const imagePath = `uploads/${Date.now()}-cropped.jpg`;

                    await sharp(buffer)
                        .resize(555, 748)
                        .jpeg({ quality: 100 })
                        .toFile(imagePath);

                    newImageUrls.push(imagePath);
                    console.log("Cropped Image Saved:", imagePath);
                }
            }
        }

        // Update product details
        product.productName = productName;
        product.description = description;
        product.category = new mongoose.Types.ObjectId(category_id);
        product.price = parseFloat(price);
        product.imageUrls = [...updatedImageUrls, ...newImageUrls];

        await product.save();
        console.log("Product updated successfully!");

        res.redirect('/admin/products');

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};
exports.getProductVariants = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).select('variants');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product.variants);
    } catch (error) {
        console.error('Error fetching variants:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update stock of a specific variant
exports.updateVariantStock = async (req, res) => {
    try {
        const { productId, variantId } = req.params;
        const { stock } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        variant.stock = stock;
        await product.save();

        res.json({ message: 'Stock updated successfully', variant });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.toggleBlockUser = async (req, res) => {
  try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
          return res.status(404).send("User not found");
      }

      console.log("Before toggle:", user.isBlock); // Debugging

      user.isBlock = !user.isBlock;
      await user.markModified("isBlock"); // Force Mongoose to detect change
      await user.save();

      console.log("After toggle:", user.isBlock); // Debugging
      res.redirect("/admin/users");
  } catch (error) {
      console.error("Error toggling user block status:", error);
      res.status(500).send("Internal Server Error");
  }
};


require("dotenv").config(); // Load environment variables


exports.adminLogin = (req, res) => {
  const { username, password } = req.body;

  // Check if username matches admin credentials
  if (username !== process.env.ADMIN_USERNAME) {
      return res.status(401).json({ success: false, message: "Invalid username" });
  }

  // Verify password using bcrypt
  const isPasswordValid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD);
  if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid password" });
  }

  // Store admin session
  req.session.admin = true;

  // Ensure session is saved before redirecting
  req.session.save((err) => {
      if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ success: false, message: "Server error" });
      }
      return res.json({ success: true, redirect: "/admin/products" });
  });
};


// Render admin login page
exports.getLogin = async (req, res) => {
    res.render("adminlogin");
};



// Middleware to check session expiration
exports.sessionChecker = (req, res, next) => {
  if (req.session.adminLoggedIn) {
      const currentTime = Date.now();
      if (currentTime > req.session.expiryTime) {
          req.session.destroy(() => {
              res.status(401).json({ expired: true, message: "Session expired, log in to continue" });
          });
      } else {
          next();
      }
  } else {
      next();
  }
};

//Dashboard
const Order = require('../models/Order'); // Import Order model

const Category = require('../models/Category'); // Import Category model
exports.getSalesData = async (req, res) => {
    try {
        const timeRange = req.query.range || "daily"; // Get selected range

        let dateFormat;
        if (timeRange === "weekly") {
            dateFormat = "%Y-%U"; // Group by Year-Week
        } else if (timeRange === "monthly") {
            dateFormat = "%Y-%m"; // Group by Year-Month
        } else {
            dateFormat = "%Y-%m-%d"; // Default: Daily
        }

        const totalSalesResult = await Order.aggregate([
            {
                $match: {
                    status: { $ne: "Cancelled" },
                    orderDate: { $exists: true }
                }
            },
            { $unwind: "$products" },
            {
                $match: {
                    // Exclude refunded and returned products
                    "products.isDelete": { $ne: true },  // Exclude deleted/refunded products
                    "products.refundSuccess": { $ne: true }, // Exclude refunded products
                    "products.return_cancel.returnInitiated": { $ne: true }, // Exclude returned products
                    "products.return_cancel.returnStatus": { $ne: "Accepted" } // Exclude accepted returns
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat,
                        date: { $toDate: "$orderDate" } } },
                    totalRevenue: { $sum: "$products.discountedPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const salesData = totalSalesResult.map(s => ({
            date: s._id,
            totalRevenue: s.totalRevenue
        }));

        let productSales = {};
        let categorySales = {};
        let overallOrderCount = 0;
        let overallOrderAmount = 0;
        let overallDiscount = 0;
        let totalCouponDiscount = 0;  // <-- New Variable for Coupon Discount

        const orders = await Order.find({ status: { $ne: "Cancelled" } });
        for (const order of orders) {
            overallOrderCount++; // Count each order
        
            if (order.orderSummary?.couponDiscount) {
                totalCouponDiscount += order.orderSummary.couponDiscount;
            }
        
            for (const item of order.products) {
                if (
                    item.isDelete === true || // Ignore refunded items
                    (item.return_cancel?.returnInitiated === true && item.return_cancel?.returnStatus === "Accepted")
                ) {
                    continue;
                }
        
                if (!productSales[item.productid]) {
                    productSales[item.productid] = { quantity: 0, revenue: 0 };
                }
                productSales[item.productid].quantity += item.quantity;
                productSales[item.productid].revenue += item.discountedPrice;
        
                overallOrderAmount += item.discountedPrice; // Total order amount
                overallDiscount += (item.totalPrice - item.discountedPrice); // Total discount
            }
        }
        

        const productIds = Object.keys(productSales);
        const products = await Product.find({ _id: { $in: productIds } }).populate('category');

        let fastSellingProducts = [];
        products.forEach(product => {
            const productId = product._id.toString();
            if (productSales[productId]) {
                fastSellingProducts.push({
                    productName: product.productName,
                    quantity: productSales[productId].quantity
                });

                const categoryId = product.category?._id?.toString();
                if (categoryId) {
                    if (!categorySales[categoryId]) {
                        categorySales[categoryId] = { totalRevenue: 0, totalQuantity: 0 };
                    }
                    categorySales[categoryId].totalRevenue += productSales[productId].revenue;
                    categorySales[categoryId].totalQuantity += productSales[productId].quantity;
                }
            }
        });

        fastSellingProducts = fastSellingProducts.sort((a, b) => b.quantity - a.quantity).slice(0, 5);

        const categories = await Category.find();
        const categoryData = categories.map(cat => ({
            categoryName: cat.name,
            totalRevenue: categorySales[cat._id]?.totalRevenue || 0,
            totalQuantity: categorySales[cat._id]?.totalQuantity || 0
        }));

        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
            return res.json({ 
                salesData, 
                fastSellingProducts, 
                categoryData, 
                overallOrderCount, 
                overallOrderAmount, 
                overallDiscount,
                totalCouponDiscount
            });
        }

        res.render('dashboard', { 
            salesData, 
            fastSellingProducts, 
            categoryData, 
            overallOrderCount, 
            overallOrderAmount, 
            overallDiscount,
            totalCouponDiscount, 
            timeRange 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

exports.getSalesReport = async (req, res) => {
    try {
        let { period, startDate, endDate } = req.query;
        let filter = {};
        let start, end;

        const today = new Date();
        if (period === 'weekly') {
            start = new Date();
            start.setDate(today.getDate() - 7);
            end = new Date();
        } else if (period === 'monthly') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'yearly') {
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'custom' && startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999); 
        } else {
            start = new Date('2000-01-01');
            end = new Date(); 
        }

        filter.orderDate = { $gte: start, $lte: end };

        const orders = await Order.find(filter).populate({
            path: 'products.productid',
            populate: { path: 'category' }
        });

        const categories = await Category.find({});
        const categoryMap = categories.reduce((acc, cat) => {
            acc[cat._id.toString()] = cat.name;
            return acc;
        }, {});

        let salesData = {
            totalOrders: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            totalCouponDiscount: 0,
            totalCancelledProduct: 0,
            totalReturns: 0,
            totalCancelledOrders: 0,
            productSales: {},
            categorySales: {},
            fastSellingProducts: []
        };
        
        for (let order of orders) {
            salesData.totalOrders++;
        
            if (order.status !== "Cancelled") {
                salesData.totalCouponDiscount += order.orderSummary.couponDiscount;
        
                for (let product of order.products) {
                    if (!product.productid) continue;
        
                    let productId = product.productid._id.toString();
                    let categoryId = product.productid.category ? product.productid.category._id.toString() : "Unknown Category";
                    let categoryName = categoryMap[categoryId] || "Unknown";
        
                    let isReturned = product.return_cancel?.returnRequested === true && product.return_cancel.returnStatus === "Accepted";
                    let isCancelledProduct = product.isDelete === true && product.refundSuccess === true &&
                        ["Wallet", "card"].includes(product.refundGivenMethod);
        
                    let discountAmount = product.totalPrice - product.discountedPrice;
                    let actualPaidAmount = product.discountedPrice; // Amount actually paid after discount
        
                    // Initialize product sales data if not exists
                    if (!salesData.productSales[productId]) {
                        salesData.productSales[productId] = {
                            name: product.productid.productName,
                            sold: 0,      // Total sold quantity
                            returned: 0,  // Total returned quantity
                            color: product.color,
                            size: product.size,
                            pricePerUnit: product.pricePerUnit,
                            totalSales: 0, // Total revenue considering returns and cancellations
                            discountSales:0
                        };
                    }
                    // Ensure categorySales[categoryId] exists
                    if (!salesData.categorySales[categoryId]) {
                        salesData.categorySales[categoryId] = { name: categoryName, totalSold: 0 ,sales:0};
                    }
        
                    // If product is returned, increase returns and reduce sold quantity
                    if (isReturned) {
                        salesData.productSales[productId].returned += product.quantity;
                        // Remove from sold count
                        salesData.totalReturns += product.quantity; // Add to total return count
                    } 
                    // If product is cancelled, exclude from total sales
                    else if (isCancelledProduct) {
                        salesData.totalCancelledProduct += product.quantity;
                        salesData.productSales[productId].returned += product.quantity;
                    } 
                    // Otherwise, add to sales
                    else {
                        salesData.productSales[productId].sold += product.quantity; // Add to sold count
                        salesData.totalRevenue += actualPaidAmount; // Add to revenue
                        salesData.totalDiscount += discountAmount;  // Add to total discount
                          // Update total sales after considering returns
                    salesData.productSales[productId].totalSales = 
                    salesData.productSales[productId].sold * product.pricePerUnit;
                    salesData.productSales[productId].discountSales += product.discountedPrice;
                        if(salesData.totalRevenue<600){
                            salesData.totalCouponDiscount -= order.orderSummary.couponDiscount;
                        }

                        salesData.categorySales[categoryId].totalSold += product.quantity;
                        salesData.categorySales[categoryId].sales += product.discountedPrice;
                    }
        
                }
            } else {
                salesData.totalCancelledOrders++;
            }
        }
        
        // Sorting products based on highest total sales
        salesData.fastSellingProducts = Object.values(salesData.productSales)
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5); // Display top 5 selling products
        
        // Render the page with sales data and selected period
        res.render('salesReport', { salesData, period, startDate, endDate });

    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
const puppeteer = require('puppeteer');
exports.downloadPDF = async (req, res) => {
    try {
        
        const { startDate, endDate, period } = req.query;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        // Corrected URL with debug logging
        const url = `http://localhost:3000/admin/sales-report?startDate=${startDate}&endDate=${endDate}&period=${period}`;
        console.log("Generated PDF URL:", url);
        
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector(".table-responsive tbody tr", { timeout: 10000 });
        // Debug: Take screenshot before PDF generation
        await page.screenshot({ path: "pdf_debug.png" });

        // Ensure hidden rows are visible
        await page.evaluate(() => {
            document.querySelectorAll('.hidden-row').forEach(row => {
                row.classList.remove('hidden-row');
            });
        });

        // Ensure all tables are centered & resized properly
        await page.evaluate(() => {
            document.querySelectorAll('table').forEach(table => {
                table.style.width = '80%';
                table.style.margin = '0 auto';
                table.style.fontSize = '12px';
                table.style.borderCollapse = 'collapse';
            });
        });

        // Hide buttons & forms from the PDF
        await page.evaluate(() => {
            document.querySelectorAll('.no-print, form, button').forEach(el => el.style.display = 'none');
        });
        const salesData = await page.evaluate(() => {
            return document.querySelector('.table-responsive tbody tr').innerText;
        });
        // Generate PDF with proper scaling
        const pdfBuffer = await page.pdf({ 
            format: "A4", 
            printBackground: true,
            scale: 0.8  // Reduce size if tables are too large
        });

        await browser.close();

        res.setHeader("Content-Disposition", 'attachment; filename="Sales_Report.pdf"');
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", pdfBuffer.length);

        res.end(pdfBuffer);
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Error generating PDF");
    }
};  





const XLSX = require("xlsx");

exports.downloadExcel = async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        // Correct URL to fetch filtered data
        const url = `http://localhost:3000/admin/sales-report?startDate=${startDate}&endDate=${endDate}&period=${period}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Wait for table to be present
        await page.waitForSelector("table", { timeout: 10000 });

        // Extract table data
        const tableData = await page.evaluate(() => {
            const rows = [];
            document.querySelectorAll("table tr").forEach((row) => {
                const rowData = [];
                row.querySelectorAll("th, td").forEach((cell) => {
                    rowData.push(cell.innerText.trim());
                });
                rows.push(rowData);
            });
            return rows;
        });

        await browser.close();

        if (tableData.length === 0) {
            return res.status(400).send("No data available to export.");
        }

        // Convert to Excel format using XLSX
        const worksheet = XLSX.utils.aoa_to_sheet(tableData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");

        // Save Excel file temporarily
        const excelFilePath = path.join(__dirname, "sales_report.xlsx");
        XLSX.writeFile(workbook, excelFilePath);

        // Send file as response
        res.setHeader("Content-Disposition", 'attachment; filename="Sales_Report.xlsx"');
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        res.sendFile(excelFilePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).send("Error downloading Excel");
            }
            // Optional: Remove the file after sending to free up space
            fs.unlinkSync(excelFilePath);
        });
    } catch (error) {
        console.error("Error generating Excel:", error);
        res.status(500).send("Error generating Excel");
    }
};
