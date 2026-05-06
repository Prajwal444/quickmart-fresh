require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const { products } = require("./data");
const { productImageUrl: productImage } = require("./imageCatalog");

const connect = () => mongoose.connect(process.env.MONGO_URI);

const seed = async () => {
  await connect();
  await Promise.all([Order.deleteMany(), Product.deleteMany(), User.deleteMany()]);

  const [admin, customer] = await User.create([
    {
      name: "QuickMart Admin",
      email: "admin@quickmart.test",
      password: "admin123",
      role: "admin",
      phone: "9000000001",
      addresses: [
        {
          label: "Warehouse",
          line1: "Dark Store 7, Market Road",
          area: "Indiranagar",
          city: "Bengaluru",
          pincode: "560038",
        },
      ],
    },
    {
      name: "Aarav Customer",
      email: "customer@quickmart.test",
      password: "customer123",
      role: "customer",
      phone: "9000000002",
      profilePicture: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop",
      status: "active",
      wallet: { balance: 460, cashback: 84 },
      membership: { plan: "QuickPass", active: true, saved: 620 },
      loyalty: { points: 680, tier: "Gold" },
      referral: { code: "AARAV50", earned: 150 },
      preferences: {
        diet: "veg",
        language: "English",
        currency: "INR",
        dietaryFilters: ["vegetarian", "low sugar"],
        favoriteCategories: ["Fresh", "Dairy", "Snacks"],
      },
      security: {
        deviceId: "demo-device-web",
        multiDeviceAllowed: true,
        encryptedData: true,
        privacyMode: false,
      },
      wallet: {
        balance: 460,
        cashback: 84,
        transactions: [
          { label: "Cashback from grocery week", amount: 84, type: "credit", status: "success" },
          { label: "Wallet top-up", amount: 300, type: "credit", status: "success" },
        ],
      },
      paymentMethods: [
        { type: "UPI", label: "Google Pay", provider: "gpay", last4: "0002", default: true },
        { type: "Card", label: "HDFC Visa", provider: "visa", last4: "4242", default: false },
        { type: "Wallet", label: "QuickMart Wallet", provider: "quickmart", last4: "0460", default: false },
      ],
      notifications: [
        { title: "Coupon unlocked", body: "FRESH75 is ready for your next basket.", read: false },
        { title: "Bananas are back", body: "Your frequently bought fruit is in stock nearby.", read: false },
      ],
      addresses: [
        {
          label: "Home",
          line1: "42, Sunrise Apartments",
          area: "Koramangala",
          city: "Bengaluru",
          pincode: "560034",
          instructions: "Leave at the security desk if I do not answer.",
        },
        {
          label: "Office",
          line1: "3rd Floor, Workhub",
          area: "Indiranagar",
          city: "Bengaluru",
          pincode: "560038",
          instructions: "Call at reception.",
        },
      ],
    },
  ]);

  const createdProducts = await Product.insertMany(
    products.map(
      ([
        slug,
        name,
        brand,
        category,
        subcategory,
        packSize,
        price,
        mrp,
        discountLabel,
        image,
        tags,
        stock,
      ]) => ({
        slug,
        name,
        brand,
        category,
        subcategory,
        packSize,
        price,
        mrp,
        discountLabel,
        image: productImage(category, name, brand, subcategory),
        tags,
        stock,
        gallery: [
          productImage(category, name, brand, subcategory),
          productImage(category, name, brand, `${subcategory} gallery`),
        ],
        variants: [
          { label: packSize, packSize, price, mrp, stock },
          {
            label: "Family pack",
            packSize: category === "Fresh" ? "1 kg" : "2 pack",
            price: Math.round(price * 1.8),
            mrp: Math.round(mrp * 1.9),
            stock: Math.max(Math.floor(stock / 2), 4),
          },
        ],
        substitutes: [
          {
            name: `${brand} alternate`,
            packSize,
            price: Math.max(price - 5, 10),
          },
          {
            name: `Store recommended ${subcategory}`,
            packSize,
            price,
          },
        ],
        nutrition: {
          calories: category === "Fresh" ? "Low calorie" : `${Math.max(40, Math.round(price / 2))} kcal/serving`,
          protein: category === "Dairy" ? "Good source" : "See pack",
          carbs: category === "Snacks" || category === "Instant Food" ? "Moderate" : "Low",
          fat: category === "Dairy" || category === "Snacks" ? "See pack" : "Low",
          ingredients: `${name}, permitted stabilisers where applicable`,
          allergenInfo: category === "Dairy" ? "Contains milk" : "May contain traces of nuts or gluten",
        },
        reviews: [
          { userName: "Nisha", rating: 5, comment: "Fresh stock and quick delivery." },
          { userName: "Rahul", rating: 4, comment: "Good value for the price." },
        ],
        reviewCount: 2,
        dietaryTags: [
          category === "Fresh" || category === "Dairy" ? "vegetarian" : "standard",
          category === "Fresh" ? "vegan" : "quick pick",
          price < 100 ? "budget" : "premium",
        ],
        sponsored: ["Snacks", "Drinks", "Beauty"].includes(category),
        regionPrices: {
          Bengaluru: price,
          Mysuru: Math.max(price - 3, 10),
          Hyderabad: price + 2,
        },
        highlights: [
          "Packed from nearby store",
          "Quality checked before dispatch",
          category === "Fresh" ? "Morning stock" : "Fast moving item",
        ],
        shelfLife: category === "Fresh" || category === "Dairy" ? "2-5 days" : "Best before 6 months",
        origin: category === "Fresh" ? "Local market partner" : "Authorised distributor",
        etaMinutes: category === "Electronics" ? 18 : 9,
        isHandpicked: ["Fresh", "Dairy", "Beauty"].includes(category),
        isVeg: category !== "Pet Care",
      })
    )
  );

  const orderItems = createdProducts.slice(0, 4).map((product, index) => ({
    product: product._id,
    name: product.name,
    image: product.image,
    packSize: product.packSize,
    price: product.price,
    mrp: product.mrp,
    quantity: index === 0 ? 2 : 1,
  }));

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  await Order.create({
    user: customer._id,
    items: orderItems,
    address: customer.addresses[0],
    deliverySlot: "Arriving in 9 minutes",
    paymentMode: "upi",
    paymentStatus: "paid",
    notes: {
      coupon: "FRESH75",
      deliveryInstruction: "Ring the bell once",
      replacementChoice: "Call before replacing unavailable items",
      supportIssue: "",
    },
    status: "Out for delivery",
    subtotal,
    discount: 74,
    deliveryFee: 0,
    tax: Math.round(subtotal * 0.05),
    handlingFee: 6,
    total: subtotal - 74 + 6 + Math.round(subtotal * 0.05),
    invoiceNumber: "GST-DEMO0001",
    etaMinutes: 7,
    timeline: [
      { label: "Order placed", time: "12:10 AM", done: true },
      { label: "Picker assigned", time: "12:11 AM", done: true },
      { label: "Packed", time: "12:14 AM", done: true },
      { label: "Out for delivery", time: "12:16 AM", done: true },
      { label: "Delivered", time: "Expected 12:23 AM", done: false },
    ],
  });

  console.log("Seeded QuickMart Fresh with users, products, and one live order.");
  console.log("Customer: customer@quickmart.test / customer123");
  console.log("Admin: admin@quickmart.test / admin123");
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
