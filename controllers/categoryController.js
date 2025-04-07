const Category = require("../models/Category");
const Product = require("../models/Product");
let Order=require("../models/Order");

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        const categoryData = [];
       
        const categoryMap= new Map();
        const orders= await Order.find({status:{$ne:"Cancelled"}});
        for(let order of orders){
             for(let item of order.products){
                const {isDelete,return_cancel,productid}=item;
                if(!isDelete||!return_cancel.cancelRequested){
                    const product=await Product.findById(productid);
                    if(product&&product.category){
                        const category= product.category.toString();
                        categoryMap.set(category,(categoryMap.get(category)||0)+1);
                    }
                }
             }
        }
        for (let category of categories) {
            let categoryObj = category.toObject();
            const products = await Product.find({ category: category._id });

            const totalStock = products.reduce((sum, product) => {
                return sum + product.variants.reduce((variantSum, variant) => variantSum + variant.stock, 0);
            }, 0);
            
            const totalSales = categoryMap.get(category._id.toString()||0);

            await Category.findByIdAndUpdate(category._id, { totalStock, totalSales });
            
            categoryObj.totalStock = totalStock;
            categoryObj.totalSales = totalSales;

            categoryData.push(categoryObj);
        }
        
        res.render("category", { categories: categoryData });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching categories");
    }
};

// Add a new category
exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const image = req.file ? req.file.filename : "default.jpg";

        // Check if category already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.send("<script>alert('Category already exists!'); window.location.href='/admin/category';</script>");
        }

        const newCategory = new Category({ name, image, isDeleted: false });
        await newCategory.save();

        res.redirect("/admin/category");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding category");
    }
};

// Edit an existing category
exports.editCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const { id } = req.params;

        if (!id) {
            return res.status(400).send("Category ID is required");
        }

        // Find the existing category
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).send("Category not found");
        }

        // Check if a category with the new name already exists (excluding current category)
        const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
        if (existingCategory) {
            return res.send("<script>alert('Category name already exists!'); window.location.href='/admin/category';</script>");
        }

        // If no new image is uploaded, keep the existing image
        const image = req.file ? req.file.filename : category.image;

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(id, { name, image }, { new: true });

        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).send("Error updating category");
    }
};


// Soft Delete Category
// Toggle Delete/Restore Category
exports.toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).send("Category not found");
        }

        // Toggle isDeleted value
        category.isDeleted = !category.isDeleted;
        await category.save();

        res.redirect("/admin/category");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating category status");
    }
};
