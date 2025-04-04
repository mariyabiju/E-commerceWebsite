const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  products: [
    {
      productid: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
                  color: String,
                  size: String,
                  pricePerUnit: Number,
                  quantity: Number,
                  totalPrice: Number,
                  discountedPrice:Number,
                  finalDiscount:Number,
                  isDelete:{ type: Boolean, default: false },
                  refundSuccess: { type: Boolean, default: false }, 
                  refundGivenMethod: { type: String, default: "" },
                  return_cancel: {
                    cancelRequested: { type: Boolean, default: false },
                    returnRequested: { type: Boolean, default: false },
                    returnStatus: { type: String, default: "" },
                    returnReason: { type: String, default: "" },
                    refundMethod: { type: String, default: "" },
                    returnInitiated: { type: Boolean, default: false }
                  }
    }
  ],
  refund: { type: Boolean, default: false },
  refundMethod:{ type: String, default: "" },
  orderDate: { type: Date, default: Date.now }, // Order placed date
  status: { type: String, required: true, default: "Pending" }, // Order status (Pending, Shipped, Delivered, Cancelled, Returned)

  paymentDetails: {
    method: { 
      type: String, 
      enum: ["COD", "Wallet", "card", "upi"], 
      required: true 
    }, // Payment method
    transactionId: { type: String }, // Transaction ID for online payments
    
    paymentStatus: { 
      type: String, 
      enum: ["Pending", "Completed", "Failed", "Refunded"], 
      default: "Pending" 
    }, // Payment status
    refundId: { type: String } // Refund transaction ID (if applicable)
  },

  address: { type: Object, required: true }, // Stores delivery address

  expectedDelivery: { type: Date }, // Estimated delivery date

  orderSummary: {
    shippingFee: { type: Number, required: true, default: 0 },
    shippingMethod: { type: String, default: "Standard" },
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    couponDiscount: { type: Number, required: true },
    total: { type: Number, required: true }
  },

  updatedAt: { type: Date, default: Date.now }, // Last updated timestamp

  orderNumber: { type: String, unique: true, required: true } // Unique order number
});

OrderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    try {
      const lastOrder = await mongoose.model("Order").findOne({}, { orderNumber: 1 }).sort({ _id: -1 });
      let orderCount = lastOrder ? parseInt(lastOrder.orderNumber.replace("ORD", "")) + 1 : 1;
      this.orderNumber = `ORD${orderCount}`;
    } catch (error) {
      return next(error);
    }
  }

  // Set expected delivery date to 10 days from the order date
  if (!this.expectedDelivery) {
    this.expectedDelivery = new Date(this.orderDate);
    this.expectedDelivery.setDate(this.expectedDelivery.getDate() + 10);
  }

  next();
});

module.exports = mongoose.model("Order", OrderSchema);

