require("dotenv").config();

const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const path = require("path");
const stripeFactory = require("stripe");

const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const { categories } = require("./data");
const { productImageUrl } = require("./imageCatalog");
const { adminOnly, auth, signToken } = require("./middleware/auth");

const app = express();
const port = process.env.PORT || 4100;
const clientDist = path.join(__dirname, "../client/dist");
const stripe = process.env.STRIPE_SECRET_KEY
  ? stripeFactory(process.env.STRIPE_SECRET_KEY)
  : null;
const emailOtpStore = new Map();
const recentOrderAttempts = new Map();

const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    })
  : null;

const coupons = [
  { code: "FRESH75", title: "Flat Rs 75 off", minCart: 499, discount: 75 },
  { code: "SNACKS20", title: "20% off snacks", minCart: 249, discount: 50 },
  { code: "FREESHIP", title: "Free delivery", minCart: 149, discount: 29 },
];

const marketingCampaigns = [
  { id: "mega-grocery-week", name: "Mega grocery week", status: "Live", budget: 24000, conversion: "9.8%" },
  { id: "late-night-snacks", name: "Late night snacks", status: "Scheduled", budget: 12000, conversion: "6.1%" },
  { id: "baby-care-payday", name: "Baby care payday", status: "Draft", budget: 9000, conversion: "New" },
];

const homeBanners = [
  { id: "mega-grocery-week", title: "Mega grocery week", placement: "Home hero", status: "Live" },
  { id: "late-night-restock", title: "Late night restock", placement: "Search top", status: "Live" },
  { id: "fresh-under-99", title: "Fresh under 99", placement: "Category rail", status: "Queued" },
];

const deliveryPartners = [
  { id: "aman-verma", name: "Aman Verma", city: "Bengaluru", status: "On trip", rating: 4.8, deliveries: 38 },
  { id: "pooja-rao", name: "Pooja Rao", city: "Bengaluru", status: "Available", rating: 4.7, deliveries: 29 },
  { id: "imran-khan", name: "Imran Khan", city: "Mysuru", status: "Break", rating: 4.6, deliveries: 21 },
];

const storeStaff = [
  { id: "ritu-picker", name: "Ritu", role: "Picker", store: "Koramangala Dark Store", ordersPacked: 46 },
  { id: "naveen-inventory", name: "Naveen", role: "Inventory lead", store: "Indiranagar Dark Store", ordersPacked: 31 },
  { id: "sneha-support", name: "Sneha", role: "Support", store: "Remote Ops", ordersPacked: 18 },
];

const mutableOrderStatuses = ["Placed", "Packing", "Out for delivery"];
const allowedOrderStatuses = ["Placed", "Packing", "Out for delivery", "Delivered", "Cancelled"];
const allowedPaymentModes = ["cod", "upi", "card", "wallet"];
const normalizePaymentMode = (mode) => {
  const normalized = String(mode || "cod").toLowerCase();
  return allowedPaymentModes.includes(normalized) ? normalized : "cod";
};

const synonyms = {
  wafers: "chips",
  coke: "drink",
  curd: "dairy",
  dahi: "dairy",
  sabzi: "fresh",
  soap: "body wash",
};

const serviceZones = [
  { area: "Koramangala", city: "Bengaluru", eta: 10, available: true, latitude: 12.9352, longitude: 77.6245 },
  { area: "Indiranagar", city: "Bengaluru", eta: 12, available: true, latitude: 12.9784, longitude: 77.6408 },
  { area: "HSR", city: "Bengaluru", eta: 14, available: true, latitude: 12.9116, longitude: 77.6389 },
  { area: "Mysuru Central", city: "Mysuru", eta: 18, available: true, latitude: 12.2958, longitude: 76.6394 },
  { area: "Remote Area", city: "Bengaluru", eta: 0, available: false, latitude: 13.1986, longitude: 77.7066 },
];

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendEmailOtp = async ({ email, otp, name }) => {
  if (!mailer) {
    throw new Error("SMTP is not configured");
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Your QuickMart Fresh login OTP",
    text: `Hi ${name || "there"}, your QuickMart Fresh OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>QuickMart Fresh login</h2>
        <p>Hi ${name || "there"}, use this OTP to continue:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</div>
        <p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>
      </div>
    `,
  });
};

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const toPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const toNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const slugify = (value) =>
  String(value || "product")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const imageFor = productImageUrl;

const restoreOrderStock = async (order) => {
  const operations = (order.items || [])
    .filter((item) => item.product && Number(item.quantity) > 0)
    .map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: Number(item.quantity) } },
      },
    }));
  if (operations.length) await Product.bulkWrite(operations, { ordered: false });
};

const reserveOrderStock = async (order) => {
  const operations = (order.items || [])
    .filter((item) => item.product && Number(item.quantity) > 0)
    .map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: -Number(item.quantity) } },
      },
    }));
  if (operations.length) await Product.bulkWrite(operations, { ordered: false });
};

const orderConsumesStock = (status) => status !== "Cancelled";
const orderCanRestoreStock = (status) => mutableOrderStatuses.includes(status);

const ensureStockAvailable = async (items) => {
  const products = await Product.find({ _id: { $in: items.map((item) => item.product) } }).select("name stock");
  for (const item of items) {
    const product = products.find((candidate) => String(candidate._id) === String(item.product));
    if (!product) throw new Error("Product not found while checking stock");
    if ((product.stock || 0) < Number(item.quantity || 0)) {
      throw new Error(`${product.name} has only ${product.stock || 0} available`);
    }
  }
};

const toProductQuery = (query) => {
  const filter = {};

  if (query.category && query.category !== "All") filter.category = query.category;
  if (query.brands) {
    const brands = String(query.brands)
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean);
    if (brands.length) filter.brand = { $in: brands.map((brand) => new RegExp(`^${brand}$`, "i")) };
  }
  if (query.handpicked === "true") filter.isHandpicked = true;
  if (query.inStock === "true") filter.stock = { $gt: 0 };
  const maxPrice = toFiniteNumber(query.maxPrice);
  const deliveryEta = toFiniteNumber(query.deliveryEta);
  if (maxPrice !== null) filter.price = { ...(filter.price || {}), $lte: maxPrice };
  if (deliveryEta !== null) filter.etaMinutes = { $lte: deliveryEta };
  if (query.discount) {
    const discount = toFiniteNumber(query.discount);
    if (discount !== null) {
      filter.$expr = {
        $gte: [
          {
            $multiply: [
              {
                $cond: [
                  { $gt: ["$mrp", 0] },
                  { $divide: [{ $subtract: ["$mrp", "$price"] }, "$mrp"] },
                  0,
                ],
              },
              100,
            ],
          },
          discount,
        ],
      };
    }
  }
  if (query.q) {
    const search = synonyms[String(query.q).toLowerCase()] || query.q;
    filter.$or = [
      { name: new RegExp(search, "i") },
      { brand: new RegExp(search, "i") },
      { tags: new RegExp(search, "i") },
      { dietaryTags: new RegExp(search, "i") },
      { category: new RegExp(search, "i") },
    ];
  }
  if (query.dietary && query.dietary !== "all") filter.dietaryTags = new RegExp(query.dietary, "i");
  const rating = toFiniteNumber(query.rating);
  if (rating !== null) filter.rating = { $gte: rating };

  return filter;
};

const toProductSort = (sort = "relevance") => {
  if (sort === "price-low") return { price: 1, stock: -1, name: 1 };
  if (sort === "price-high") return { price: -1, stock: -1, name: 1 };
  if (sort === "eta") return { etaMinutes: 1, stock: -1, name: 1 };
  if (sort === "discount") return { discountAmount: -1, stock: -1, name: 1 };
  return { isExpress: -1, stock: -1, name: 1 };
};

const priceSummary = (items, couponCode = "") => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrpTotal = items.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  const productDiscount = Math.max(mrpTotal - subtotal, 0);
  const normalizedCoupon = String(couponCode || "").trim().toUpperCase();
  const selectedCoupon = coupons.find((item) => item.code === normalizedCoupon);
  const couponEligible = Boolean(selectedCoupon && subtotal >= selectedCoupon.minCart);
  const baseDeliveryFee = subtotal >= 299 ? 0 : 29;
  const couponDiscount = couponEligible && selectedCoupon.code !== "FREESHIP"
    ? Math.min(selectedCoupon.discount, subtotal)
    : 0;
  const couponSavings = couponEligible && selectedCoupon.code === "FREESHIP" ? baseDeliveryFee : couponDiscount;
  const deliveryFee = selectedCoupon?.code === "FREESHIP" && couponEligible ? 0 : baseDeliveryFee;
  const handlingFee = items.length ? 6 : 0;
  const tax = Math.round(subtotal * 0.05);

  return {
    subtotal,
    mrpTotal,
    discount: productDiscount + couponSavings,
    productDiscount,
    couponDiscount: couponSavings,
    coupon: selectedCoupon
      ? {
          code: selectedCoupon.code,
          title: selectedCoupon.title,
          applied: couponEligible,
          message: couponEligible
            ? `${selectedCoupon.code} applied`
            : `Add ${Math.max(selectedCoupon.minCart - subtotal, 0)} more to use ${selectedCoupon.code}`,
        }
      : null,
    deliveryFee,
    handlingFee,
    tax,
    total: Math.max(subtotal + deliveryFee + handlingFee + tax - couponDiscount, 0),
    freeDeliveryShortBy: deliveryFee === 0 ? 0 : Math.max(299 - subtotal, 0),
  };
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "quickmart-fresh" });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();
  let user = await User.findOne({ email: normalizedEmail }).select(
    "+password"
  );

  if (normalizedEmail === "admin@quickmart.test" && password === "admin123") {
    if (!user) {
      user = await User.create({
        name: "QuickMart Admin",
        email: normalizedEmail,
        password: "admin123",
        role: "admin",
        phone: "9000000001",
        status: "active",
      });
      user = await User.findById(user._id).select("+password");
    } else if (!(await user.comparePassword(password)) || user.role !== "admin" || user.status !== "active") {
      user.password = "admin123";
      user.role = "admin";
      user.status = "active";
      await user.save();
      user = await User.findById(user._id).select("+password");
    }
  }

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  if (user.status === "deactivated") {
    return res.status(403).json({ message: "This account is deactivated. Contact support or admin to reactivate it." });
  }

  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ user: await User.findById(user._id), token });
});

app.post("/api/auth/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }
  if (!req.body.password || String(req.body.password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: "Email already registered" });
  const user = await User.create({
    name: req.body.name || "New QuickMart Shopper",
    email,
    phone: req.body.phone || "",
    password: req.body.password || "quickmart123",
    profilePicture: req.body.profilePicture || "",
    preferences: {
      diet: req.body.diet || "veg",
      language: req.body.language || "English",
      currency: "INR",
      dietaryFilters: [req.body.diet || "veg"],
      favoriteCategories: ["Fresh", "Dairy"],
    },
    wallet: {
      balance: 100,
      cashback: 0,
      transactions: [{ label: "Signup welcome wallet credit", amount: 100, type: "credit", status: "success" }],
    },
    paymentMethods: [
      { type: "Wallet", label: "QuickMart Wallet", provider: "quickmart", last4: "0100", default: true },
    ],
    addresses: req.body.address
      ? [req.body.address]
      : [
          {
            label: "Home",
            line1: "New signup address",
            area: "Koramangala",
            city: "Bengaluru",
            pincode: "560034",
            instructions: "Demo signup address",
          },
        ],
  });
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.status(201).json({ user, token });
});

app.post("/api/auth/email-otp/request", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  const otp = createOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  emailOtpStore.set(email, {
    otpHash,
    name: req.body.name || "",
    phone: req.body.phone || "",
    purpose: req.body.purpose || "login",
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });

  try {
    await sendEmailOtp({ email, otp, name: req.body.name });
    res.json({
      ok: true,
      channel: "email",
      email,
      expiresInSeconds: 600,
      message: `OTP sent to ${email}`,
    });
  } catch (error) {
    emailOtpStore.delete(email);
    res.status(500).json({
      message: "Could not send email OTP. Check SMTP settings or app password.",
      detail: error.message,
    });
  }
});

app.post("/api/auth/email-otp/verify", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();
  const record = emailOtpStore.get(email);

  if (!record) return res.status(400).json({ message: "Request an OTP first" });
  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(email);
    return res.status(400).json({ message: "OTP expired. Request a new code." });
  }
  if (record.attempts >= 5) {
    emailOtpStore.delete(email);
    return res.status(429).json({ message: "Too many OTP attempts. Request a new code." });
  }

  const valid = await bcrypt.compare(otp, record.otpHash);
  if (!valid) {
    record.attempts += 1;
    emailOtpStore.set(email, record);
    return res.status(400).json({ message: "Invalid OTP" });
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: req.body.name || record.name || `Email Shopper ${email.split("@")[0]}`,
      email,
      phone: req.body.phone || record.phone || "",
      password: `email-otp-${Date.now()}`,
      wallet: {
        balance: 100,
        transactions: [{ label: "Email OTP signup credit", amount: 100, type: "credit", status: "success" }],
      },
      paymentMethods: [
        { type: "Wallet", label: "QuickMart Wallet", provider: "quickmart", last4: "0100", default: true },
      ],
      addresses: [
        {
          label: "Home",
          line1: "Email OTP signup address",
          area: "Koramangala",
          city: "Bengaluru",
          pincode: "560034",
          instructions: "Created after real email OTP verification",
        },
      ],
    });
  }

  emailOtpStore.delete(email);
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ user, token, message: "Email OTP verified" });
});

app.post("/api/auth/otp", async (req, res) => {
  if (req.body.email) {
    return res.status(410).json({
      message: "Email OTP now uses /api/auth/email-otp/request and /api/auth/email-otp/verify",
    });
  }

  const phone = String(req.body.phone || "9000000002");
  let user = await User.findOne({ phone });

  if (!user) {
    user = await User.create({
      name: `Quick Shopper ${phone.slice(-4)}`,
      email: `otp-${phone}@quickmart.test`,
      password: "otp-demo",
      phone,
      addresses: [
        {
          label: "Current",
          line1: "GPS detected building",
          area: "Koramangala",
          city: "Bengaluru",
          pincode: "560034",
          instructions: "Demo GPS address",
        },
      ],
    });
  }

  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ user, otp: "123456", message: "Demo OTP accepted automatically" });
});

app.post("/api/auth/social", async (req, res) => {
  const provider = ["google", "apple"].includes(req.body.provider) ? req.body.provider : "google";
  const email = `${provider}.shopper@quickmart.test`;
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: provider === "apple" ? "Apple Demo Shopper" : "Google Demo Shopper",
      email,
      password: `${provider}-demo`,
      phone: provider === "apple" ? "9000000101" : "9000000102",
      addresses: [
        {
          label: "Home",
          line1: "OAuth demo apartment",
          area: "Indiranagar",
          city: "Bengaluru",
          pincode: "560038",
          instructions: "Leave at security",
        },
      ],
    });
  }

  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ user, provider, message: `${provider} demo login complete` });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

app.patch("/api/me/profile", auth, async (req, res) => {
  const allowed = ["name", "phone", "profilePicture"];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field];
  });
  await req.user.save();
  res.json({ user: req.user });
});

app.post("/api/me/email-change/request", auth, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid new email is required" });
  }
  if (email === req.user.email) {
    return res.status(400).json({ message: "This is already your account email" });
  }

  const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
  if (existing) return res.status(409).json({ message: "Email already registered" });

  const otp = createOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const key = `email-change:${req.user._id}:${email}`;
  emailOtpStore.set(key, {
    otpHash,
    purpose: "email-change",
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });

  try {
    await sendEmailOtp({ email, otp, name: req.user.name });
    res.json({
      ok: true,
      email,
      expiresInSeconds: 600,
      message: `Email change OTP sent to ${email}`,
    });
  } catch (error) {
    emailOtpStore.delete(key);
    res.status(500).json({
      message: "Could not send email change OTP. Check SMTP settings or app password.",
      detail: error.message,
    });
  }
});

app.patch("/api/me/email-change/verify", auth, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();
  const key = `email-change:${req.user._id}:${email}`;
  const record = emailOtpStore.get(key);

  if (!record) return res.status(400).json({ message: "Request an OTP for this email first" });
  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(key);
    return res.status(400).json({ message: "OTP expired. Request a new code." });
  }
  if (record.attempts >= 5) {
    emailOtpStore.delete(key);
    return res.status(429).json({ message: "Too many OTP attempts. Request a new code." });
  }

  const valid = await bcrypt.compare(otp, record.otpHash);
  if (!valid) {
    record.attempts += 1;
    emailOtpStore.set(key, record);
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
  if (existing) return res.status(409).json({ message: "Email already registered" });

  req.user.email = email;
  await req.user.save();
  emailOtpStore.delete(key);
  res.json({ user: req.user, message: "Email changed after real OTP verification" });
});

app.post("/api/me/contact/otp", auth, (req, res) => {
  res.json({
    otp: "123456",
    target: req.body.email || req.body.phone,
    message: "Demo OTP generated for profile contact change",
  });
});

app.patch("/api/me/contact", auth, async (req, res) => {
  if (req.body.otp !== "123456") {
    return res.status(400).json({ message: "Invalid demo OTP" });
  }
  if (req.body.phone) req.user.phone = req.body.phone;
  await req.user.save();
  res.json({ user: req.user, message: "Phone updated after demo OTP verification" });
});

app.patch("/api/me/deactivate", auth, async (req, res) => {
  req.user.status = "deactivated";
  await req.user.save();
  res.clearCookie("token");
  res.json({ ok: true, message: "Account deactivated. Login again to reactivate in this demo." });
});

app.post("/api/me/addresses", auth, async (req, res) => {
  req.user.addresses.push({
    label: req.body.label || "New address",
    line1: req.body.line1 || "Apartment / floor",
    area: req.body.area || "Koramangala",
    city: req.body.city || "Bengaluru",
    pincode: req.body.pincode || "560034",
    instructions: req.body.instructions || "",
  });
  await req.user.save();
  res.status(201).json({ user: req.user });
});

app.patch("/api/me/addresses/:addressId", auth, async (req, res) => {
  const address = req.user.addresses.id(req.params.addressId);
  if (!address) return res.status(404).json({ message: "Address not found" });
  Object.assign(address, req.body);
  await req.user.save();
  res.json({ user: req.user });
});

app.delete("/api/me/addresses/:addressId", auth, async (req, res) => {
  req.user.addresses.pull(req.params.addressId);
  await req.user.save();
  res.json({ user: req.user });
});

app.patch("/api/me/wishlist/:productId", auth, async (req, res) => {
  const id = req.params.productId;
  const hasProduct = req.user.wishlist.some((item) => String(item) === id);
  req.user.wishlist = hasProduct
    ? req.user.wishlist.filter((item) => String(item) !== id)
    : [...req.user.wishlist, id];
  await req.user.save();
  const user = await User.findById(req.user._id).populate("wishlist");
  res.json({ user, wishlist: user.wishlist || [], products: user.wishlist || [], saved: !hasProduct });
});

app.patch("/api/me/preferences", auth, async (req, res) => {
  req.user.preferences = { ...(req.user.preferences || {}), ...req.body };
  await req.user.save();
  res.json({ user: req.user });
});

app.patch("/api/me/privacy", auth, async (req, res) => {
  req.user.security = {
    ...(req.user.security || {}),
    privacyMode: Boolean(req.body.privacyMode),
    multiDeviceAllowed: Boolean(req.body.multiDeviceAllowed ?? req.user.security?.multiDeviceAllowed),
  };
  await req.user.save();
  res.json({ user: req.user });
});

app.get("/api/me/wallet/history", auth, (req, res) => {
  res.json({
    balance: req.user.wallet?.balance || 0,
    cashback: req.user.wallet?.cashback || 0,
    transactions: req.user.wallet?.transactions || [],
    refunds: [
      { label: "Refund for unavailable item", amount: 38, status: "processed" },
      { label: "COD adjustment", amount: 12, status: "pending" },
    ],
  });
});

app.delete("/api/me", auth, async (req, res) => {
  if (req.body.confirmation !== "DELETE") {
    return res.status(400).json({ message: "Type DELETE to permanently remove this demo account" });
  }
  await User.findByIdAndDelete(req.user._id);
  res.clearCookie("token");
  res.json({ ok: true, message: "Demo account deleted" });
});

app.get("/api/me/wishlist", auth, async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  res.json({ products: user.wishlist || [] });
});

app.get("/api/me/notifications", auth, (req, res) => {
  res.json({ notifications: req.user.notifications || [] });
});

app.patch("/api/me/notifications/read", auth, async (req, res) => {
  req.user.notifications = (req.user.notifications || []).map((item) => {
    const notification = item.toObject ? item.toObject() : item;
    return { ...notification, read: true };
  });
  await req.user.save();
  res.json({ notifications: req.user.notifications });
});

app.get("/api/coupons", (req, res) => {
  res.json({ coupons });
});

app.get("/api/serviceability", (req, res) => {
  const rawArea = String(req.query.area || "Koramangala");
  const area = rawArea.toLowerCase();
  const zone = serviceZones.find((item) => {
    const zoneArea = item.area.toLowerCase();
    return zoneArea.includes(area) || area.includes(zoneArea);
  }) || {
    area: rawArea || "Unknown location",
    city: "Outside coverage",
    eta: 0,
    available: false,
  };
  res.json({
    zone,
    message: zone.available
      ? `Delivery available in ${zone.area} within ${zone.eta} minutes`
      : "Sorry, this area is outside the current demo service zone",
  });
});

app.get("/api/serviceability/zones", (req, res) => {
  res.json({ zones: serviceZones });
});

app.get("/api/reverse-geocode", async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ message: "Valid latitude and longitude are required" });
  }

  const fallback = {
    displayName: `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    city: "Detected by GPS",
    pincode: "",
  };

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "QuickMartFreshLocalDemo/1.0",
          Accept: "application/json",
        },
      }
    );
    if (!response.ok) throw new Error("Reverse geocode failed");
    const data = await response.json();
    const address = data.address || {};
    res.json({
      displayName: data.display_name || fallback.displayName,
      city: address.city || address.town || address.village || address.suburb || fallback.city,
      pincode: address.postcode || "",
      road: address.road || address.neighbourhood || address.suburb || "",
    });
  } catch {
    res.json(fallback);
  }
});

app.get("/api/support/faqs", (req, res) => {
  res.json({
    faqs: [
      { q: "How do refunds work?", a: "Refunds are auto-created for missing or unavailable items." },
      { q: "Can I modify an order?", a: "Demo orders can be modified while they are still Placed or Packing." },
      { q: "Can I pay by COD?", a: "Yes, COD, UPI, cards and wallet modes are available in the demo checkout." },
    ],
  });
});

app.get("/api/home", async (req, res) => {
  const [quickPicks, handpicked, deals] = await Promise.all([
    Product.find().sort({ stock: -1 }).limit(8),
    Product.find({ isHandpicked: true }).limit(8),
    Product.find().sort({ mrp: -1 }).limit(8),
  ]);

  res.json({
    location: {
      label: "Delivering to Home",
      area: "Koramangala, Bengaluru",
      eta: "8-12 mins",
    },
    banners: [
      {
        title: "Mega grocery week",
        subtitle: "Fresh picks, snacks, cleaning essentials and more",
        cta: "Up to 50% off",
        tone: "sunrise",
      },
      {
        title: "Late night restock",
        subtitle: "Cold drinks, chips, noodles and desserts",
        cta: "Arrives in 9 mins",
        tone: "night",
      },
    ],
    categories,
    quickPicks,
    handpicked,
    deals,
    buyAgain: quickPicks.slice(0, 4),
    trending: deals.slice(0, 6),
    sponsored: deals.slice(0, 3).map((item) => ({ ...item.toObject(), sponsored: true })),
    timeBased: new Date().getHours() >= 20 ? deals.slice(0, 4) : handpicked.slice(0, 4),
  });
});

app.get("/api/products", async (req, res) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = toPositiveInt(req.query.limit, 24, 60);
  const skip = (page - 1) * limit;
  const filter = toProductQuery(req.query);
  const brandContextFilter = { ...filter };
  delete brandContextFilter.brand;
  const sort = toProductSort(req.query.sort);
  const pipeline = [
    { $match: filter },
    { $addFields: { discountAmount: { $subtract: ["$mrp", "$price"] } } },
    { $sort: sort },
    { $facet: {
      products: [{ $skip: skip }, { $limit: limit }],
      count: [{ $count: "total" }],
    } },
  ];
  const [result] = await Product.aggregate(pipeline);
  const products = result?.products || [];
  const total = result?.count?.[0]?.total || 0;
  const availableBrands = await Product.distinct("brand", brandContextFilter);

  res.json({
    products,
    filters: {
      availableBrands: availableBrands.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    },
    pagination: {
      page,
      limit,
      total,
      loaded: Math.min(skip + products.length, total),
      hasMore: skip + products.length < total,
    },
  });
});

app.get("/api/products/:slug", async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).json({ message: "Product not found" });
  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(6);
  res.json({ product, related });
});

app.post("/api/products/:id/reviews", auth, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const rating = Math.min(Math.max(Number(req.body.rating || 5), 1), 5);
  product.reviews.push({
    userName: req.user.name,
    rating,
    comment: req.body.comment || "Fresh and delivered quickly.",
  });
  product.reviewCount = product.reviews.length;
  product.rating = Number(
    (product.reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / product.reviews.length).toFixed(1)
  );
  await product.save();
  res.status(201).json({ product });
});

app.get("/api/recommendations", async (req, res) => {
  const q = String(req.query.q || "");
  const ids = String(req.query.cart || "")
    .split(",")
    .filter(Boolean);
  const cartProducts = ids.length ? await Product.find({ _id: { $in: ids } }) : [];
  const categoriesFromCart = cartProducts.map((item) => item.category);
  const filter = q
    ? toProductQuery({ q })
    : categoriesFromCart.length
      ? { category: { $in: categoriesFromCart }, _id: { $nin: ids } }
      : { isHandpicked: true };
  const products = await Product.find(filter).sort({ rating: -1, stock: -1 }).limit(8);
  res.json({
    title: cartProducts.length ? "Frequently bought together" : "Personalized picks",
    reason: cartProducts.length
      ? "Based on your current basket"
      : "Based on fast-moving items, ratings and local availability",
    products,
  });
});

app.post("/api/cart/quote", async (req, res) => {
  const ids = (req.body.items || []).map((item) => item.product);
  const products = await Product.find({ _id: { $in: ids } });
  const items = (req.body.items || [])
    .map((cartItem) => {
      const product = products.find((item) => String(item._id) === cartItem.product);
      if (!product) return null;

      return {
        product: product._id,
        name: product.name,
        image: product.image,
        packSize: product.packSize,
        price: product.price,
        mrp: product.mrp,
        quantity: Math.min(cartItem.quantity, product.stock),
        stock: product.stock,
      };
    })
    .filter(Boolean);

  res.json({ items, summary: priceSummary(items, req.body.coupon) });
});

app.post("/api/orders", auth, async (req, res) => {
  const ids = (req.body.items || []).map((item) => item.product);
  const products = await Product.find({ _id: { $in: ids } });
  const requestedItems = req.body.items || [];
  const paymentMode = normalizePaymentMode(req.body.paymentMode);
  const duplicateKey = `${req.user._id}:${requestedItems
    .map((item) => `${item.product}:${item.quantity}`)
    .sort()
    .join("|")}:${paymentMode}`;
  const lastAttemptAt = recentOrderAttempts.get(duplicateKey);
  if (lastAttemptAt && Date.now() - lastAttemptAt < 120000) {
    return res.status(409).json({
      message: "Duplicate order protection: this same cart was just placed. Check Orders before retrying.",
    });
  }
  const items = (req.body.items || [])
    .map((cartItem) => {
      const product = products.find((item) => String(item._id) === cartItem.product);
      if (!product) return null;
      const requestedQuantity = Number(cartItem.quantity || 1);
      const quantity = Math.min(requestedQuantity, product.stock);

      return {
        product: product._id,
        name: product.name,
        image: product.image,
        packSize: product.packSize,
        price: product.price,
        mrp: product.mrp,
        quantity,
        requestedQuantity,
        fulfillmentStatus:
          quantity <= 0 ? "unavailable" : quantity < requestedQuantity ? "partially fulfilled" : "fulfilled",
      };
    })
    .filter((item) => item && item.quantity > 0);

  if (!items.length) return res.status(400).json({ message: "Cart is empty" });

  const summary = priceSummary(items, req.body.notes?.coupon);
  const unavailableItems = requestedItems
    .map((cartItem) => {
      const product = products.find((item) => String(item._id) === cartItem.product);
      if (!product) return "Removed unavailable item";
      if (product.stock <= 0) return product.name;
      if (product.stock < Number(cartItem.quantity || 1)) {
        return `${product.name} reduced to ${product.stock}`;
      }
      return null;
    })
    .filter(Boolean);
  const order = await Order.create({
    user: req.user._id,
    items,
    address: req.body.address || req.user.addresses[0],
    deliverySlot: req.body.deliverySlot || "Arriving in 10 minutes",
    paymentMode,
    paymentStatus: paymentMode === "cod" ? "pending" : "paid",
    status: "Placed",
    subtotal: summary.subtotal,
    discount: summary.discount,
    deliveryFee: summary.deliveryFee,
    tax: summary.tax,
    handlingFee: summary.handlingFee,
    total: summary.total,
    invoiceNumber: `GST-${Date.now().toString().slice(-8)}`,
    deliveryPin: String(Math.floor(1000 + Math.random() * 9000)),
    partialFulfillment: {
      hasChanges: unavailableItems.length > 0,
      unavailableItems,
      replacementPolicy: req.body.notes?.replacementChoice || "Call before replacing unavailable items",
    },
    etaMinutes: 10,
    timeline: [
      { label: "Order placed", time: "Now", done: true },
      { label: "Picker assigned", time: "Next", done: false },
      { label: "Packed", time: "Soon", done: false },
      { label: "Out for delivery", time: "In 7 mins", done: false },
      { label: "Delivered", time: "In 10 mins", done: false },
    ],
  });
  recentOrderAttempts.set(duplicateKey, Date.now());

  await Promise.all(
    items.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } })
    )
  );

  req.user.loyalty = {
    points: (req.user.loyalty?.points || 0) + Math.floor(summary.total / 10),
    tier: summary.total > 999 ? "Gold" : req.user.loyalty?.tier || "Silver",
  };
  req.user.notifications = [
    {
      title: "Order placed",
      body: `Your ${items.length}-item order is being packed and will arrive soon.`,
      read: false,
    },
    ...(req.user.notifications || []),
  ].slice(0, 12);
  req.user.wallet = {
    ...(req.user.wallet || {}),
    transactions: [
      {
        label: `Payment for order ${order._id.toString().slice(-6).toUpperCase()}`,
        amount: summary.total,
        type: paymentMode === "wallet" ? "debit" : "payment",
        status: paymentMode === "cod" ? "pending" : "success",
      },
      ...(req.user.wallet?.transactions || []),
    ].slice(0, 20),
  };
  await req.user.save();

  res.status(201).json({ order });
});

app.get("/api/orders", auth, async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user._id };
  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
});

app.get("/api/orders/:id", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot view this order" });
  }
  res.json({ order });
});

app.patch("/api/orders/:id/cancel", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot cancel this order" });
  }
  if (!mutableOrderStatuses.includes(order.status)) {
    return res.status(400).json({ message: "Order can only be cancelled before delivery" });
  }
  await restoreOrderStock(order);
  order.status = "Cancelled";
  order.refundStatus = order.paymentMode === "cod" ? "none" : "initiated";
  order.timeline = [...(order.timeline || []), { label: "Cancelled", time: "Now", done: true }];
  await order.save();
  res.json({ order });
});

app.patch("/api/orders/:id/modify", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot modify this order" });
  }
  if (!mutableOrderStatuses.includes(order.status)) {
    return res.status(400).json({ message: "Order can only be modified before delivery" });
  }

  const productId = String(req.body.product || "");
  const nextQuantity = toNonNegativeInt(req.body.quantity, 0);
  const item = order.items.find((line) => String(line.product) === productId);
  if (!item) return res.status(404).json({ message: "Item not found in order" });
  const currentQuantity = Number(item.quantity || 0);
  const quantityDelta = nextQuantity - currentQuantity;

  if (quantityDelta > 0) {
    const product = await Product.findById(productId).select("stock name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    if ((product.stock || 0) < quantityDelta) {
      return res.status(409).json({
        message: `${product.name} has only ${product.stock || 0} more available`,
      });
    }
  }

  if (nextQuantity <= 0) {
    order.items = order.items.filter((line) => String(line.product) !== productId);
  } else {
    item.quantity = nextQuantity;
    item.requestedQuantity = nextQuantity;
  }
  if (quantityDelta !== 0) {
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -quantityDelta } });
  }

  if (!order.items.length) {
    order.status = "Cancelled";
    order.refundStatus = order.paymentMode === "cod" ? "none" : "initiated";
    order.timeline = [...(order.timeline || []), { label: "Cancelled", time: "Now", done: true }];
    await order.save();
    return res.json({ order });
  }
  const summary = priceSummary(order.items, order.notes?.coupon);
  Object.assign(order, {
    subtotal: summary.subtotal,
    discount: summary.discount,
    deliveryFee: summary.deliveryFee,
    tax: summary.tax,
    handlingFee: summary.handlingFee,
    total: summary.total,
  });
  order.timeline = [...(order.timeline || []), { label: "Order modified", time: "Now", done: true }];
  await order.save();
  res.json({ order });
});

app.patch("/api/orders/:id/replacement", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot update this order" });
  }
  if (!mutableOrderStatuses.includes(order.status)) {
    return res.status(400).json({ message: "Replacement preference can only be changed before delivery" });
  }
  order.partialFulfillment = {
    ...(order.partialFulfillment || {}),
    hasChanges: true,
    replacementPolicy: req.body.replacementPolicy || "Customer approved closest replacement",
  };
  order.timeline = [...(order.timeline || []), { label: "Replacement preference updated", time: "Now", done: true }];
  await order.save();
  res.json({ order });
});

app.patch("/api/orders/:id/rating", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot rate this order" });
  }
  order.deliveryRating = Math.min(Math.max(Number(req.body.rating || 5), 1), 5);
  order.deliveryFeedback = {
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    comment: req.body.comment || "",
    ratedAt: new Date(),
  };
  await order.save();
  res.json({ order });
});

app.get("/api/orders/:id/invoice", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot view this invoice" });
  }
  res.json({
    invoice: {
      number: order.invoiceNumber || `GST-${order._id.toString().slice(-8).toUpperCase()}`,
      gstin: "29ABCDE1234F1Z5",
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount || 0,
      deliveryFee: order.deliveryFee || 0,
      handlingFee: order.handlingFee || 0,
      tax: order.tax || Math.round((order.subtotal || 0) * 0.05),
      total: order.total,
      paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus,
      billedTo: order.address,
      issuedAt: order.createdAt,
    },
  });
});

app.patch("/api/orders/:id/support", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ message: "You cannot update this order" });
  }

  order.notes = {
    ...(order.notes || {}),
    supportIssue: req.body.issue || "Support requested",
  };
  await order.save();
  res.json({ order });
});

app.patch("/api/me/wallet", auth, async (req, res) => {
  const amount = Number(req.body.amount || 0);
  req.user.wallet = {
    balance: Math.max((req.user.wallet?.balance || 0) + amount, 0),
    cashback: req.user.wallet?.cashback || 0,
    transactions: [
      {
        label: amount >= 0 ? "Wallet top-up" : "Wallet debit",
        amount: Math.abs(amount),
        type: amount >= 0 ? "credit" : "debit",
        status: "success",
      },
      ...(req.user.wallet?.transactions || []),
    ].slice(0, 20),
  };
  await req.user.save();
  res.json({ user: req.user });
});

app.patch("/api/admin/products/bulk", auth, adminOnly, async (req, res) => {
  const filter = req.body.category ? { category: req.body.category } : {};
  const update = {};
  const inc = {};
  if (req.body.stockDelta !== undefined) inc.stock = Number(req.body.stockDelta);
  if (req.body.etaMinutes !== undefined) update.etaMinutes = Number(req.body.etaMinutes);
  if (req.body.sponsored !== undefined) update.sponsored = toBoolean(req.body.sponsored);
  if (req.body.isExpress !== undefined) update.isExpress = toBoolean(req.body.isExpress);

  const operations = [];
  if (Object.keys(update).length) operations.push(Product.updateMany(filter, update));
  if (Object.keys(inc).length && inc.stock !== 0) operations.push(Product.updateMany(filter, { $inc: inc }));
  if (!operations.length) return res.status(400).json({ message: "No bulk operation selected" });
  const results = await Promise.all(operations);
  res.json({ ok: true, matched: results.reduce((sum, item) => sum + (item.matchedCount || 0), 0) });
});

app.patch("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  if (req.body.category && !categories.some((item) => item.name.toLowerCase() === String(req.body.category).toLowerCase())) {
    categories.push({ name: req.body.category, icon: "🛒", accent: "#16a34a" });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ product });
});

app.post("/api/admin/products", auth, adminOnly, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: "Product name is required" });
  if (req.body.category && !categories.some((item) => item.name.toLowerCase() === String(req.body.category).toLowerCase())) {
    categories.push({ name: req.body.category, icon: "🛒", accent: "#16a34a" });
  }
  const baseSlug = slugify(req.body.slug || `${req.body.brand || "QuickMart"}-${req.body.name}-${req.body.packSize || "item"}`);
  const existingSlug = await Product.exists({ slug: baseSlug });
  const slug = existingSlug ? `${baseSlug}-${Date.now().toString().slice(-6)}` : baseSlug;
  const fallbackImage = imageFor(req.body.category || "QuickMart", req.body.name, req.body.brand || "QuickMart", req.body.subcategory || "");
  const image = req.body.image || fallbackImage;
  const product = await Product.create({
    ...req.body,
    slug,
    brand: req.body.brand || "QuickMart",
    mrp: req.body.mrp || req.body.price,
    image,
    gallery:
      req.body.gallery ||
      [image, imageFor(req.body.category || "QuickMart", req.body.name, req.body.brand || "QuickMart", req.body.subcategory || "gallery")],
    tags: req.body.tags || [req.body.category, req.body.name].filter(Boolean),
    variants: req.body.variants || [],
    substitutes: req.body.substitutes || [],
    highlights: req.body.highlights || ["Packed from nearby store", "Quality checked"],
  });

  res.status(201).json({ product });
});

app.delete("/api/admin/products/:id", auth, adminOnly, async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ ok: true, id: req.params.id });
});

app.get("/api/admin/products/export", auth, adminOnly, async (req, res) => {
  const products = await Product.find().sort({ category: 1, name: 1 });
  res.json({
    count: products.length,
    products,
    csv: [
      "name,brand,category,subcategory,packSize,price,mrp,stock,etaMinutes",
      ...products.map((product) =>
        [
          product.name,
          product.brand,
          product.category,
          product.subcategory,
          product.packSize,
          product.price,
          product.mrp,
          product.stock,
          product.etaMinutes,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n"),
  });
});

app.get("/api/admin/categories", auth, adminOnly, (req, res) => {
  res.json({ categories });
});

app.post("/api/admin/categories", auth, adminOnly, (req, res) => {
  const category = {
    name: req.body.name,
    icon: req.body.icon || "🛒",
    accent: req.body.accent || "#16a34a",
  };
  if (!category.name) return res.status(400).json({ message: "Category name is required" });
  if (categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) {
    return res.status(409).json({ message: "Category already exists" });
  }
  categories.push(category);
  res.status(201).json({ category, categories });
});

app.patch("/api/admin/categories/:name", auth, adminOnly, async (req, res) => {
  const index = categories.findIndex((item) => item.name.toLowerCase() === req.params.name.toLowerCase());
  if (index === -1) return res.status(404).json({ message: "Category not found" });
  const currentName = categories[index].name;
  const nextName = String(req.body.name || currentName).trim();
  if (!nextName) return res.status(400).json({ message: "Category name is required" });
  const duplicate = categories.some(
    (item, itemIndex) => itemIndex !== index && item.name.toLowerCase() === nextName.toLowerCase()
  );
  if (duplicate) return res.status(409).json({ message: "Category already exists" });

  categories[index] = {
    ...categories[index],
    name: nextName,
    icon: req.body.icon || categories[index].icon,
    accent: req.body.accent || categories[index].accent,
  };
  if (nextName !== currentName) {
    await Product.updateMany({ category: currentName }, { category: nextName });
  }
  res.json({ category: categories[index], categories });
});

app.delete("/api/admin/categories/:name", auth, adminOnly, async (req, res) => {
  const index = categories.findIndex((item) => item.name.toLowerCase() === req.params.name.toLowerCase());
  if (index === -1) return res.status(404).json({ message: "Category not found" });
  const productCount = await Product.countDocuments({ category: categories[index].name });
  if (productCount) {
    return res.status(409).json({
      message: `Move or delete ${productCount} products before deleting this category`,
    });
  }
  const [category] = categories.splice(index, 1);
  res.json({ ok: true, category, categories });
});

app.get("/api/admin/marketing", auth, adminOnly, (req, res) => {
  res.json({ coupons, campaigns: marketingCampaigns, banners: homeBanners });
});

app.post("/api/admin/coupons", auth, adminOnly, (req, res) => {
  const coupon = {
    code: String(req.body.code || "").toUpperCase(),
    title: req.body.title || "New coupon",
    minCart: Number(req.body.minCart || 0),
    discount: Number(req.body.discount || 0),
  };
  if (!coupon.code) return res.status(400).json({ message: "Coupon code is required" });
  if (coupons.some((item) => item.code === coupon.code)) {
    return res.status(409).json({ message: "Coupon already exists" });
  }
  coupons.push(coupon);
  res.status(201).json({ coupon, coupons });
});

app.patch("/api/admin/coupons/:code", auth, adminOnly, (req, res) => {
  const index = coupons.findIndex((item) => item.code === req.params.code.toUpperCase());
  if (index === -1) return res.status(404).json({ message: "Coupon not found" });
  coupons[index] = {
    ...coupons[index],
    ...req.body,
    code: req.body.code ? String(req.body.code).toUpperCase() : coupons[index].code,
    minCart: req.body.minCart !== undefined ? Number(req.body.minCart) : coupons[index].minCart,
    discount: req.body.discount !== undefined ? Number(req.body.discount) : coupons[index].discount,
  };
  res.json({ coupon: coupons[index], coupons });
});

app.delete("/api/admin/coupons/:code", auth, adminOnly, (req, res) => {
  const index = coupons.findIndex((item) => item.code === req.params.code.toUpperCase());
  if (index === -1) return res.status(404).json({ message: "Coupon not found" });
  const [coupon] = coupons.splice(index, 1);
  res.json({ ok: true, coupon, coupons });
});

app.post("/api/admin/campaigns", auth, adminOnly, (req, res) => {
  const campaign = {
    id: req.body.id || String(req.body.name || "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: req.body.name || "New campaign",
    status: req.body.status || "Draft",
    budget: Number(req.body.budget || 0),
    conversion: req.body.conversion || "New",
  };
  marketingCampaigns.push(campaign);
  res.status(201).json({ campaign, campaigns: marketingCampaigns });
});

app.patch("/api/admin/campaigns/:id", auth, adminOnly, (req, res) => {
  const index = marketingCampaigns.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Campaign not found" });
  marketingCampaigns[index] = {
    ...marketingCampaigns[index],
    ...req.body,
    budget: req.body.budget !== undefined ? Number(req.body.budget) : marketingCampaigns[index].budget,
  };
  res.json({ campaign: marketingCampaigns[index], campaigns: marketingCampaigns });
});

app.delete("/api/admin/campaigns/:id", auth, adminOnly, (req, res) => {
  const index = marketingCampaigns.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Campaign not found" });
  const [campaign] = marketingCampaigns.splice(index, 1);
  res.json({ ok: true, campaign, campaigns: marketingCampaigns });
});

app.post("/api/admin/banners", auth, adminOnly, (req, res) => {
  const banner = {
    id: req.body.id || String(req.body.title || "banner").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: req.body.title || "New banner",
    placement: req.body.placement || "Home hero",
    status: req.body.status || "Draft",
  };
  homeBanners.push(banner);
  res.status(201).json({ banner, banners: homeBanners });
});

app.patch("/api/admin/banners/:id", auth, adminOnly, (req, res) => {
  const index = homeBanners.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Banner not found" });
  homeBanners[index] = { ...homeBanners[index], ...req.body };
  res.json({ banner: homeBanners[index], banners: homeBanners });
});

app.delete("/api/admin/banners/:id", auth, adminOnly, (req, res) => {
  const index = homeBanners.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Banner not found" });
  const [banner] = homeBanners.splice(index, 1);
  res.json({ ok: true, banner, banners: homeBanners });
});

app.get("/api/admin/system", auth, adminOnly, (req, res) => {
  res.json({ deliveryPartners, storeStaff, serviceZones });
});

app.post("/api/admin/service-zones", auth, adminOnly, (req, res) => {
  const zone = {
    area: req.body.area || "New Zone",
    city: req.body.city || "Bengaluru",
    eta: Number(req.body.eta || 15),
    available: toBoolean(req.body.available, true),
  };
  if (serviceZones.some((item) => item.area.toLowerCase() === zone.area.toLowerCase())) {
    return res.status(409).json({ message: "Service zone already exists" });
  }
  serviceZones.push(zone);
  res.status(201).json({ zone, serviceZones });
});

app.patch("/api/admin/service-zones/:area", auth, adminOnly, (req, res) => {
  const index = serviceZones.findIndex((item) => item.area.toLowerCase() === req.params.area.toLowerCase());
  if (index === -1) return res.status(404).json({ message: "Service zone not found" });
  serviceZones[index] = {
    ...serviceZones[index],
    ...req.body,
    eta: req.body.eta !== undefined ? Number(req.body.eta) : serviceZones[index].eta,
    available: req.body.available !== undefined ? toBoolean(req.body.available, serviceZones[index].available) : serviceZones[index].available,
  };
  res.json({ zone: serviceZones[index], serviceZones });
});

app.delete("/api/admin/service-zones/:area", auth, adminOnly, (req, res) => {
  const index = serviceZones.findIndex((item) => item.area.toLowerCase() === req.params.area.toLowerCase());
  if (index === -1) return res.status(404).json({ message: "Service zone not found" });
  const [zone] = serviceZones.splice(index, 1);
  res.json({ ok: true, zone, serviceZones });
});

app.post("/api/admin/delivery-partners", auth, adminOnly, (req, res) => {
  const partner = {
    id: req.body.id || String(req.body.name || "delivery-partner").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: req.body.name || "New delivery partner",
    city: req.body.city || "Bengaluru",
    status: req.body.status || "Available",
    rating: Number(req.body.rating || 4.5),
    deliveries: Number(req.body.deliveries || 0),
  };
  deliveryPartners.push(partner);
  res.status(201).json({ partner, deliveryPartners });
});

app.patch("/api/admin/delivery-partners/:id", auth, adminOnly, (req, res) => {
  const index = deliveryPartners.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Delivery partner not found" });
  deliveryPartners[index] = {
    ...deliveryPartners[index],
    ...req.body,
    rating: req.body.rating !== undefined ? Number(req.body.rating) : deliveryPartners[index].rating,
    deliveries: req.body.deliveries !== undefined ? Number(req.body.deliveries) : deliveryPartners[index].deliveries,
  };
  res.json({ partner: deliveryPartners[index], deliveryPartners });
});

app.delete("/api/admin/delivery-partners/:id", auth, adminOnly, (req, res) => {
  const index = deliveryPartners.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Delivery partner not found" });
  const [partner] = deliveryPartners.splice(index, 1);
  res.json({ ok: true, partner, deliveryPartners });
});

app.post("/api/admin/store-staff", auth, adminOnly, (req, res) => {
  const staff = {
    id: req.body.id || String(req.body.name || "store-staff").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: req.body.name || "New staff member",
    role: req.body.role || "Picker",
    store: req.body.store || "Koramangala Dark Store",
    ordersPacked: Number(req.body.ordersPacked || 0),
  };
  storeStaff.push(staff);
  res.status(201).json({ staff, storeStaff });
});

app.patch("/api/admin/store-staff/:id", auth, adminOnly, (req, res) => {
  const index = storeStaff.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Store staff not found" });
  storeStaff[index] = {
    ...storeStaff[index],
    ...req.body,
    ordersPacked: req.body.ordersPacked !== undefined ? Number(req.body.ordersPacked) : storeStaff[index].ordersPacked,
  };
  res.json({ staff: storeStaff[index], storeStaff });
});

app.delete("/api/admin/store-staff/:id", auth, adminOnly, (req, res) => {
  const index = storeStaff.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Store staff not found" });
  const [staff] = storeStaff.splice(index, 1);
  res.json({ ok: true, staff, storeStaff });
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
});

app.get("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const user = await User.findById(req.params.id).populate("wishlist");
  if (!user) return res.status(404).json({ message: "User not found" });
  const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
  res.json({ user, orders });
});

app.post("/api/admin/users", auth, adminOnly, async (req, res) => {
  const email = String(req.body.email || `admin-created-${Date.now()}@quickmart.test`).toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: "Email already exists" });
  const user = await User.create({
    name: req.body.name || "Admin Created User",
    email,
    phone: req.body.phone || "",
    password: req.body.password || "user12345",
    role: req.body.role || "customer",
    status: req.body.status || "active",
    wallet: { balance: Number(req.body.walletBalance || 0), cashback: 0 },
    preferences: {
      diet: req.body.diet || "veg",
      language: req.body.language || "English",
      currency: "INR",
      favoriteCategories: ["Fresh"],
    },
    addresses: [
      {
        label: "Home",
        line1: req.body.line1 || "Admin created address",
        area: req.body.area || "Koramangala",
        city: req.body.city || "Bengaluru",
        pincode: req.body.pincode || "560034",
        instructions: req.body.instructions || "",
      },
    ],
    paymentMethods: [
      { type: "Wallet", label: "QuickMart Wallet", provider: "quickmart", last4: "0000", default: true },
    ],
  });
  res.status(201).json({ user });
});

app.patch("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  ["name", "phone", "role", "status", "profilePicture"].forEach((field) => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });
  if (req.body.email) {
    const normalizedEmail = String(req.body.email).toLowerCase();
    const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (duplicate) return res.status(409).json({ message: "Email already exists" });
    user.email = normalizedEmail;
  }
  if (req.body.walletBalance !== undefined) {
    user.wallet = { ...(user.wallet || {}), balance: Number(req.body.walletBalance) };
  }
  if (req.body.loyaltyPoints !== undefined) {
    user.loyalty = { ...(user.loyalty || {}), points: Number(req.body.loyaltyPoints) };
  }
  if (req.body.diet || req.body.language) {
    user.preferences = {
      ...(user.preferences || {}),
      ...(req.body.diet ? { diet: req.body.diet } : {}),
      ...(req.body.language ? { language: req.body.language } : {}),
    };
  }
  if (["line1", "area", "city", "pincode", "instructions"].some((field) => req.body[field] !== undefined)) {
    const current = user.addresses?.[0] || {};
    user.addresses = [
      {
        label: req.body.label || current.label || "Home",
        line1: req.body.line1 || current.line1 || "",
        area: req.body.area || current.area || "",
        city: req.body.city || current.city || "",
        pincode: req.body.pincode || current.pincode || "",
        instructions: req.body.instructions || current.instructions || "",
      },
      ...(user.addresses || []).slice(1),
    ];
  }

  await user.save();
  res.json({ user });
});

app.patch("/api/admin/users/:id/deactivate", auth, adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: "deactivated" }, { new: true });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

app.patch("/api/admin/users/:id/reactivate", auth, adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: "active" }, { new: true });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  if (String(req.user._id) === String(req.params.id)) {
    return res.status(400).json({ message: "Admin cannot delete their own active session" });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const userOrders = await Order.find({ user: req.params.id });
  await Promise.all(userOrders.filter((order) => orderCanRestoreStock(order.status)).map(restoreOrderStock));
  await Order.deleteMany({ user: req.params.id });
  res.json({ ok: true, id: req.params.id });
});

app.post("/api/admin/users/:id/orders", auth, adminOnly, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  const productIds = requestedItems.map((item) => item.product).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, stock: { $gt: 0 } })
    : await Product.find({ stock: { $gt: 0 } }).sort({ stock: -1 }).limit(3);

  const items = (products.length ? products : []).map((product, index) => {
    const requested = requestedItems.find((item) => String(item.product) === String(product._id));
    const quantity = Math.min(Math.max(1, Number(requested?.quantity || (index === 0 ? 2 : 1))), product.stock || 0);
    return {
      product: product._id,
      name: product.name,
      image: product.image,
      packSize: product.packSize,
      price: product.price,
      mrp: product.mrp,
      quantity,
      requestedQuantity: quantity,
      stock: product.stock,
    };
  }).filter((item) => item.quantity > 0);

  if (!items.length) return res.status(400).json({ message: "No products available to create an order" });

  const summary = priceSummary(items, req.body.coupon || "");
  const paymentMode = normalizePaymentMode(req.body.paymentMode);
  const status = allowedOrderStatuses.includes(req.body.status) ? req.body.status : "Placed";
  const address = user.addresses?.[0] || {
    label: "Home",
    line1: "Admin selected address",
    area: "Koramangala",
    city: "Bengaluru",
    pincode: "560034",
  };
  const order = await Order.create({
    user: user._id,
    items,
    address,
    deliverySlot: req.body.deliverySlot || "Instant delivery in 12 minutes",
    paymentMode,
    paymentStatus: req.body.paymentStatus || (paymentMode === "cod" ? "pending" : "paid"),
    notes: {
      coupon: req.body.coupon || "",
      deliveryInstruction: req.body.deliveryInstruction || address.instructions || "",
      replacementChoice: req.body.replacementChoice || "Call before replacing unavailable items",
      supportIssue: req.body.supportIssue || "",
    },
    status,
    subtotal: summary.subtotal,
    discount: summary.discount,
    deliveryFee: summary.deliveryFee,
    tax: summary.tax,
    handlingFee: summary.handlingFee,
    total: summary.total,
    invoiceNumber: `GST-ADM${Date.now().toString().slice(-6)}`,
    etaMinutes: Number(req.body.etaMinutes || 12),
    timeline: [
      { label: "Order created by admin", time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), done: true },
      { label: "Store review", time: "Pending", done: false },
      { label: "Out for delivery", time: "Pending", done: false },
    ],
  });
  if (orderConsumesStock(order.status)) {
    await reserveOrderStock(order);
  }

  res.status(201).json({ order });
});

app.patch("/api/admin/orders/:id", auth, adminOnly, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  const previousStatus = order.status;

  ["paymentStatus", "deliverySlot", "refundStatus"].forEach((field) => {
    if (req.body[field] !== undefined) order[field] = req.body[field];
  });
  if (req.body.status !== undefined) {
    if (!allowedOrderStatuses.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }
    order.status = req.body.status;
  }
  if (req.body.paymentMode !== undefined) {
    const normalizedPaymentMode = normalizePaymentMode(req.body.paymentMode);
    if (normalizedPaymentMode !== String(req.body.paymentMode).toLowerCase()) {
      return res.status(400).json({ message: "Invalid payment mode" });
    }
    order.paymentMode = normalizedPaymentMode;
  }
  ["subtotal", "discount", "deliveryFee", "tax", "handlingFee", "total", "etaMinutes", "deliveryRating"].forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== "") order[field] = Number(req.body[field]);
  });
  if (req.body.status === "Delivered") order.paymentStatus = "paid";
  if (previousStatus === "Cancelled" && req.body.status && req.body.status !== "Cancelled") {
    try {
      await ensureStockAvailable(order.items || []);
      await reserveOrderStock(order);
    } catch (error) {
      return res.status(409).json({ message: error.message });
    }
  }
  if (req.body.status === "Cancelled" && orderCanRestoreStock(previousStatus)) {
    await restoreOrderStock(order);
    order.refundStatus = order.paymentMode === "cod" ? "none" : order.refundStatus || "initiated";
  }
  if (req.body.status && req.body.status !== previousStatus) {
    order.timeline = [
      ...(order.timeline || []),
      { label: `Status changed to ${req.body.status}`, time: "Now", done: true },
    ];
  }
  if (req.body.deliveryInstruction !== undefined || req.body.coupon !== undefined || req.body.replacementChoice !== undefined || req.body.supportIssue !== undefined) {
    order.notes = {
      ...(order.notes || {}),
      ...(req.body.coupon !== undefined ? { coupon: req.body.coupon } : {}),
      ...(req.body.deliveryInstruction !== undefined ? { deliveryInstruction: req.body.deliveryInstruction } : {}),
      ...(req.body.replacementChoice !== undefined ? { replacementChoice: req.body.replacementChoice } : {}),
      ...(req.body.supportIssue !== undefined ? { supportIssue: req.body.supportIssue } : {}),
    };
  }
  if (["line1", "area", "city", "pincode", "instructions"].some((field) => req.body[field] !== undefined)) {
    order.address = {
      ...(order.address || {}),
      ...(req.body.line1 !== undefined ? { line1: req.body.line1 } : {}),
      ...(req.body.area !== undefined ? { area: req.body.area } : {}),
      ...(req.body.city !== undefined ? { city: req.body.city } : {}),
      ...(req.body.pincode !== undefined ? { pincode: req.body.pincode } : {}),
      ...(req.body.instructions !== undefined ? { instructions: req.body.instructions } : {}),
    };
  }

  await order.save();
  res.json({ order });
});

app.delete("/api/admin/orders/:id", auth, adminOnly, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (orderCanRestoreStock(order.status)) {
    await restoreOrderStock(order);
  }
  await order.deleteOne();
  res.json({ ok: true, id: req.params.id });
});

app.get("/api/delivery/console", auth, async (req, res) => {
  const activeOrders = await Order.find({ status: { $in: ["Packing", "Out for delivery"] } }).sort({ createdAt: -1 }).limit(12);
  res.json({
    partner: deliveryPartners[0],
    codCollection: activeOrders
      .filter((order) => order.paymentMode === "cod")
      .reduce((sum, order) => sum + (order.total || 0), 0),
    orders: activeOrders,
  });
});

app.patch("/api/delivery/orders/:id/proof", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (String(req.body.pin) !== String(order.deliveryPin)) {
    return res.status(400).json({ message: "Invalid delivery PIN" });
  }
  order.status = "Delivered";
  order.paymentStatus = "paid";
  order.timeline = order.timeline.map((step) =>
    step.label === "Delivered" ? { ...(step.toObject ? step.toObject() : step), done: true, time: "Now" } : step
  );
  order.notes = { ...(order.notes || {}), proof: req.body.proof || "PIN verified delivery" };
  await order.save();
  res.json({ order });
});

app.get("/api/admin/summary", auth, adminOnly, async (req, res) => {
  const [productCount, orderCount, userCount, orders, lowStock, customers, products] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    User.countDocuments({ role: "customer" }),
    Order.find(),
    Product.find({ stock: { $lte: 10 } }).sort({ stock: 1 }).limit(6),
    User.find({ role: "customer" }).sort({ createdAt: -1 }).limit(8),
    Product.find().sort({ stock: 1 }).limit(10),
  ]);

  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const delivered = orders.filter((order) => order.status === "Delivered").length;
  const activeOrders = orders.filter((order) => !["Delivered", "Cancelled"].includes(order.status));
  const categoryRevenue = orders.reduce((map, order) => {
    order.items.forEach((item) => {
      map[item.name] = (map[item.name] || 0) + item.price * item.quantity;
    });
    return map;
  }, {});

  const summary = {
    productCount,
    orderCount,
    userCount,
    revenue,
    activeOrderCount: activeOrders.length,
    conversionRate: 8.7,
    retentionRate: 62,
    inventoryTurnover: 4.3,
    avgDeliveryMinutes: 11,
    deliverySuccessRate: orderCount ? Math.round((delivered / orderCount) * 100) : 0,
    lowStock,
    liveOrders: activeOrders.slice(0, 8),
    customers,
    deliveryPartners,
    storeStaff,
    cityAnalytics: [
      { city: "Bengaluru", orders: Math.max(orderCount, 12), revenue: Math.max(revenue, 12840), eta: 10 },
      { city: "Mysuru", orders: 6, revenue: 4210, eta: 14 },
      { city: "Hyderabad", orders: 9, revenue: 7920, eta: 13 },
    ],
    deliveryMetrics: [
      { label: "Avg delivery", value: "11 min" },
      { label: "On-time rate", value: "94%" },
      { label: "Picker SLA", value: "3.2 min" },
      { label: "Refund rate", value: "1.8%" },
    ],
    categories,
    coupons,
    campaigns: marketingCampaigns,
    banners: homeBanners,
    reports: {
      revenueByDay: [
        { label: "Mon", value: 12800 },
        { label: "Tue", value: 15200 },
        { label: "Wed", value: 14100 },
        { label: "Thu", value: 18600 },
        { label: "Fri", value: Math.max(revenue, 21400) },
      ],
      topInventory: products.map((product) => ({
        name: product.name,
        stock: product.stock,
        turnover: `${Math.max(2, Math.round((product.mrp - product.price + 10) / 4))}x`,
      })),
      categoryRevenue: Object.entries(categoryRevenue)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    },
  };

  res.json({
    ...summary,
    metrics: {
      products: productCount,
      orders: orderCount,
      customers: userCount,
      revenue,
      activeOrders: activeOrders.length,
      conversionRate: summary.conversionRate,
      retentionRate: summary.retentionRate,
      inventoryTurnover: summary.inventoryTurnover,
      avgDeliveryMinutes: summary.avgDeliveryMinutes,
      deliverySuccessRate: summary.deliverySuccessRate,
    },
  });
});

app.post("/api/payments/intent", auth, async (req, res) => {
  if (!stripe) {
    return res.json({
      clientSecret: "demo_client_secret",
      message: "Stripe is not configured; checkout will use demo payment.",
    });
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(req.body.amount * 100),
    currency: "inr",
    metadata: { user: String(req.user._id) },
  });

  res.json({ clientSecret: intent.client_secret });
});

app.use(
  express.static(clientDist, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  })
);
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(clientDist, "index.html"));
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(port, () => {
      console.log(`QuickMart Fresh running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Mongo connection failed", error);
    process.exit(1);
  });
