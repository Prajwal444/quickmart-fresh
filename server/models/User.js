const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    phone: String,
    profilePicture: String,
    status: { type: String, enum: ["active", "deactivated"], default: "active" },
    membership: {
      plan: { type: String, default: "QuickPass" },
      active: { type: Boolean, default: true },
      saved: { type: Number, default: 0 },
    },
    wallet: {
      balance: { type: Number, default: 250 },
      cashback: { type: Number, default: 0 },
      transactions: [
        {
          label: String,
          amount: Number,
          type: { type: String, default: "credit" },
          status: { type: String, default: "success" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
    },
    paymentMethods: [
      {
        type: { type: String },
        label: String,
        last4: String,
        provider: String,
        default: { type: Boolean, default: false },
      },
    ],
    loyalty: {
      points: { type: Number, default: 120 },
      tier: { type: String, default: "Silver" },
    },
    referral: {
      code: { type: String, default: "" },
      earned: { type: Number, default: 0 },
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    preferences: {
      diet: { type: String, default: "veg" },
      language: { type: String, default: "English" },
      currency: { type: String, default: "INR" },
      dietaryFilters: [String],
      favoriteCategories: [String],
    },
    security: {
      deviceId: { type: String, default: "demo-device-web" },
      multiDeviceAllowed: { type: Boolean, default: true },
      encryptedData: { type: Boolean, default: true },
      privacyMode: { type: Boolean, default: false },
    },
    notifications: [
      {
        title: String,
        body: String,
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    addresses: [
      {
        label: String,
        line1: String,
        area: String,
        city: String,
        pincode: String,
        instructions: String,
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre("validate", function setReferral(next) {
  if (!this.referral?.code) {
    const base = String(this.name || "USER").replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase();
    this.referral = { ...(this.referral || {}), code: `${base || "USER"}${String(this._id).slice(-4)}` };
  }
  next();
});

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
