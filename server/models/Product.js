const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    brand: String,
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true, index: true },
    subcategory: String,
    description: String,
    packSize: String,
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
    discountLabel: String,
    image: String,
    gallery: [String],
    tags: [String],
    variants: [
      {
        label: String,
        packSize: String,
        price: Number,
        mrp: Number,
        stock: Number,
      },
    ],
    substitutes: [
      {
        name: String,
        packSize: String,
        price: Number,
      },
    ],
    nutrition: {
      calories: String,
      protein: String,
      carbs: String,
      fat: String,
      ingredients: String,
      allergenInfo: String,
    },
    reviews: [
      {
        userName: String,
        rating: Number,
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    highlights: [String],
    shelfLife: String,
    origin: String,
    rating: { type: Number, default: 4.4 },
    reviewCount: { type: Number, default: 0 },
    stock: { type: Number, default: 20 },
    etaMinutes: { type: Number, default: 10 },
    isVeg: { type: Boolean, default: true },
    dietaryTags: [String],
    sponsored: { type: Boolean, default: false },
    regionPrices: {
      Bengaluru: Number,
      Mysuru: Number,
      Hyderabad: Number,
    },
    isExpress: { type: Boolean, default: true },
    isHandpicked: { type: Boolean, default: false },
    replacementAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", brand: "text", tags: "text", category: "text" });

module.exports = mongoose.model("Product", productSchema);
