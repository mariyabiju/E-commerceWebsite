// uploadMiddleware.js
// uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
    { name: "imageUrls", maxCount: 5 },
    { name: "sizeChart", maxCount: 1 },
]);

const processImages = async (req, res, next) => {
    try {
        // Image processing logic (already in your code)
        next(); // Move to next middleware or controller
    } catch (err) {
        console.error(err);
        res.status(500).send("Image processing failed");
    }
};

// Export both middleware functions
module.exports = { upload, processImages };
