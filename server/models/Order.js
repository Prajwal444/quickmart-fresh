const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        image: String,
        packSize: String,
        price: Number,
        mrp: Number,
        quantity: Number,
        requestedQuantity: Number,
        fulfillmentStatus: { type: String, default: "fulfilled" },
      },
    ],
    address: {
      label: String,
      line1: String,
      area: String,
      city: String,
      pincode: String,
      instructions: String,
    },
    deliverySlot: String,
    paymentMode: { type: String, enum: ["cod", "upi", "card", "wallet"], default: "cod" },
    paymentStatus: { type: String, default: "pending" },
    notes: {
      coupon: String,
      deliveryInstruction: String,
      replacementChoice: String,
      supportIssue: String,
    },
    status: {
      type: String,
      enum: ["Placed", "Packing", "Out for delivery", "Delivered", "Cancelled"],
      default: "Placed",
    },
    subtotal: Number,
    discount: Number,
    deliveryFee: Number,
    tax: { type: Number, default: 0 },
    handlingFee: Number,
    total: Number,
    refundStatus: { type: String, default: "none" },
    invoiceNumber: String,
    deliveryPin: String,
    partialFulfillment: {
      hasChanges: { type: Boolean, default: false },
      unavailableItems: [String],
      replacementPolicy: String,
    },
    deliveryRating: Number,
    deliveryFeedback: {
      tags: [String],
      comment: String,
      ratedAt: Date,
    },
    etaMinutes: Number,
    rider: {
      name: { type: String, default: "Aman" },
      phone: { type: String, default: "90000 77889" },
      lat: { type: Number, default: 12.9352 },
      lng: { type: Number, default: 77.6245 },
    },
    timeline: [
      {
        label: String,
        time: String,
        done: Boolean,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
