require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");
const { productImageUrl } = require("./imageCatalog");

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const imageFor = productImageUrl;

const catalog = {
  Fresh: {
    subcategory: "Fruits & Vegetables",
    tags: ["fruit", "vegetable", "fresh", "vegan", "breakfast"],
    shelfLife: "2-5 days",
    origin: "Local farm partner",
    items: [
      ["Robusta Banana", "Farm Basket", "6 pcs", 48, 65],
      ["Yelakki Banana", "Farm Basket", "500 g", 58, 79],
      ["Royal Gala Apple", "Fresh Valley", "4 pcs", 156, 199],
      ["Pomegranate", "Fresh Valley", "2 pcs", 138, 180],
      ["Seedless Grapes", "Farm Basket", "500 g", 92, 125],
      ["Local Tomato", "Farm Basket", "500 g", 28, 42],
      ["English Cucumber", "Green Cart", "500 g", 42, 55],
      ["Carrot Orange", "Green Cart", "500 g", 46, 60],
      ["Baby Spinach", "Green Cart", "150 g", 55, 75],
      ["Coriander Bunch", "Green Cart", "1 bunch", 15, 22],
    ],
  },
  Dairy: {
    subcategory: "Milk, Curd & Paneer",
    tags: ["milk", "curd", "paneer", "protein", "vegetarian"],
    shelfLife: "2-7 days",
    origin: "Authorised dairy distributor",
    items: [
      ["Toned Milk", "Amul", "1 L", 68, 72],
      ["Full Cream Milk", "Nandini", "1 L", 74, 80],
      ["Fresh Paneer", "Milky Mist", "200 g", 96, 120],
      ["Greek Yogurt Blueberry", "Epigamia", "90 g", 48, 60],
      ["Classic Curd", "Mother Dairy", "400 g", 44, 55],
      ["Salted Butter", "Amul", "100 g", 58, 62],
      ["Cheese Slices", "Britannia", "200 g", 138, 165],
      ["Lassi Sweet", "Amul", "200 ml", 24, 30],
    ],
  },
  Snacks: {
    subcategory: "Chips, Namkeen & Munchies",
    tags: ["chips", "namkeen", "wafers", "snack", "party"],
    shelfLife: "Best before 6 months",
    origin: "Authorised distributor",
    items: [
      ["Classic Salted Chips", "Lay's", "52 g", 20, 20],
      ["Magic Masala Chips", "Lay's", "82 g", 40, 50],
      ["Mad Angles Achari", "Bingo", "72 g", 36, 50],
      ["Aloo Bhujia", "Haldiram's", "200 g", 64, 80],
      ["Moong Dal Namkeen", "Haldiram's", "200 g", 76, 95],
      ["Nacho Chips Cheese", "Doritos", "150 g", 89, 110],
      ["Salted Peanuts", "Nutty Yogi", "200 g", 99, 140],
      ["Cream Onion Wafers", "Too Yumm", "60 g", 25, 30],
    ],
  },
  Drinks: {
    subcategory: "Cold Drinks & Juices",
    tags: ["drink", "juice", "cold drink", "cola", "beverage"],
    shelfLife: "Best before 6 months",
    origin: "Beverage distributor",
    items: [
      ["Coca-Cola Zero", "Coca-Cola", "750 ml", 42, 45],
      ["Thums Up", "Coca-Cola", "750 ml", 40, 45],
      ["Pepsi Black", "Pepsi", "750 ml", 40, 45],
      ["Orange Juice", "Tropicana", "1 L", 105, 135],
      ["Mixed Fruit Juice", "Real", "1 L", 99, 130],
      ["Tender Coconut Water", "Raw Pressery", "200 ml", 48, 60],
      ["Energy Drink", "Red Bull", "250 ml", 118, 125],
      ["Mineral Water", "Bisleri", "1 L", 20, 20],
    ],
  },
  "Instant Food": {
    subcategory: "Ready to Cook",
    tags: ["noodles", "instant", "ready to cook", "breakfast"],
    shelfLife: "Best before 6 months",
    origin: "Packaged food distributor",
    items: [
      ["2-Minute Masala Noodles", "Maggi", "560 g", 108, 120],
      ["Korean Hot Noodles", "Nissin", "90 g", 48, 60],
      ["Cup Noodles Veg", "Nissin", "70 g", 44, 55],
      ["Idli Dosa Batter", "iD Fresh", "1 kg", 88, 95],
      ["Ready Poha Mix", "MTR", "180 g", 45, 60],
      ["Upma Breakfast Mix", "MTR", "180 g", 46, 60],
      ["Dal Makhani Ready Meal", "Tata Sampann", "300 g", 92, 120],
      ["Pasta Masala", "Sunfeast", "70 g", 28, 35],
    ],
  },
  "Home Care": {
    subcategory: "Cleaning & Laundry",
    tags: ["detergent", "dishwash", "cleaning", "home"],
    shelfLife: "Best before 12 months",
    origin: "Home care distributor",
    items: [
      ["Liquid Detergent", "Surf Excel", "1 L", 199, 240],
      ["Matic Detergent Powder", "Ariel", "1 kg", 220, 275],
      ["Dishwash Gel Lemon", "Vim", "750 ml", 145, 180],
      ["Floor Cleaner Citrus", "Lizol", "1 L", 186, 225],
      ["Toilet Cleaner", "Harpic", "750 ml", 112, 140],
      ["Garbage Bags Medium", "Presto", "30 bags", 119, 160],
      ["Kitchen Towel Roll", "Origami", "2 rolls", 138, 180],
      ["Mosquito Repellent Refill", "Good Knight", "45 ml", 86, 99],
    ],
  },
  Beauty: {
    subcategory: "Bath & Skin Care",
    tags: ["beauty", "skin care", "soap", "body wash"],
    shelfLife: "Best before 18 months",
    origin: "Beauty distributor",
    items: [
      ["Deep Moisture Body Wash", "Dove", "250 ml", 185, 260],
      ["Soft Light Moisturizer", "Nivea", "200 ml", 210, 299],
      ["Aloe Vera Gel", "Patanjali", "150 ml", 84, 110],
      ["Charcoal Face Wash", "Garnier", "100 g", 145, 199],
      ["Coconut Shampoo", "Parachute", "300 ml", 169, 220],
      ["Sunscreen SPF 50", "Minimalist", "50 g", 379, 399],
      ["Lip Balm Cherry", "Nivea", "4.8 g", 149, 199],
      ["Hand Wash Refill", "Dettol", "750 ml", 99, 125],
    ],
  },
  Electronics: {
    subcategory: "Accessories & Batteries",
    tags: ["cable", "charger", "battery", "electronics"],
    shelfLife: "Warranty as per brand",
    origin: "Electronics distributor",
    items: [
      ["Braided USB-C Cable", "QuickBits", "1 m", 149, 299],
      ["AA Alkaline Batteries", "Duracell", "4 pcs", 159, 220],
      ["AAA Alkaline Batteries", "Duracell", "4 pcs", 149, 210],
      ["20W Fast Charger", "QuickBits", "1 pc", 399, 799],
      ["Phone Stand", "Portronics", "1 pc", 129, 249],
      ["Bluetooth Tracker Tag", "QuickBits", "1 pc", 299, 499],
    ],
  },
  "Baby Care": {
    subcategory: "Diapers, Wipes & Food",
    tags: ["baby", "wipes", "diaper", "kids"],
    shelfLife: "Best before 12 months",
    origin: "Baby care distributor",
    items: [
      ["Gentle Baby Wipes", "Huggies", "72 wipes", 115, 150],
      ["Diaper Pants Medium", "Pampers", "38 pcs", 499, 599],
      ["Baby Lotion", "Johnson's", "200 ml", 165, 210],
      ["Baby Soap", "Himalaya", "75 g", 48, 60],
      ["Cerelac Wheat", "Nestle", "300 g", 234, 260],
      ["Feeding Bottle", "Mee Mee", "250 ml", 199, 260],
    ],
  },
  "Pet Care": {
    subcategory: "Pet Food & Care",
    tags: ["pet", "dog", "cat", "food"],
    shelfLife: "Best before 9 months",
    origin: "Pet care distributor",
    items: [
      ["Chicken Dog Food", "Pedigree", "1.2 kg", 245, 310],
      ["Adult Cat Food Tuna", "Whiskas", "480 g", 199, 240],
      ["Dog Treats", "Drools", "150 g", 115, 150],
      ["Cat Litter", "Heads Up For Tails", "5 kg", 399, 499],
      ["Pet Shampoo", "Captain Zack", "200 ml", 249, 320],
      ["Bird Food Mix", "Vitapol", "500 g", 129, 180],
    ],
  },
  Breakfast: {
    subcategory: "Cereal, Spreads & Eggs",
    tags: ["breakfast", "cereal", "oats", "spread"],
    shelfLife: "Best before 9 months",
    origin: "Breakfast foods distributor",
    items: [
      ["Rolled Oats", "Quaker", "1 kg", 185, 220],
      ["Corn Flakes", "Kellogg's", "475 g", 189, 225],
      ["Choco Cereal", "Kellogg's", "385 g", 199, 249],
      ["Peanut Butter Creamy", "Pintola", "350 g", 179, 225],
      ["Mixed Fruit Jam", "Kissan", "500 g", 155, 190],
      ["Brown Bread", "Britannia", "400 g", 46, 55],
      ["White Eggs", "Eggoz", "6 pcs", 58, 72],
      ["Muesli Fruit Nut", "Yoga Bar", "400 g", 299, 360],
    ],
  },
  Grocery: {
    subcategory: "Atta, Rice, Dal & Oil",
    tags: ["atta", "rice", "dal", "oil", "grocery"],
    shelfLife: "Best before 6-12 months",
    origin: "Grocery warehouse",
    items: [
      ["Whole Wheat Atta", "Aashirvaad", "5 kg", 239, 285],
      ["Basmati Rice", "Daawat", "5 kg", 629, 799],
      ["Sona Masoori Rice", "India Gate", "5 kg", 349, 420],
      ["Toor Dal", "Tata Sampann", "1 kg", 165, 210],
      ["Moong Dal", "Tata Sampann", "1 kg", 154, 199],
      ["Sunflower Oil", "Fortune", "1 L", 142, 170],
      ["Sugar", "Madhur", "1 kg", 48, 60],
      ["Salt Iodized", "Tata Salt", "1 kg", 24, 28],
      ["Turmeric Powder", "Everest", "200 g", 72, 90],
      ["Red Chilli Powder", "MDH", "200 g", 85, 110],
    ],
  },
  Bakery: {
    subcategory: "Breads, Cakes & Cookies",
    tags: ["bakery", "bread", "cookies", "cake"],
    shelfLife: "2-30 days",
    origin: "Bakery partner",
    items: [
      ["Multigrain Bread", "English Oven", "400 g", 58, 70],
      ["Garlic Bread Loaf", "The Baker's Dozen", "250 g", 99, 125],
      ["Chocolate Muffins", "Theobroma", "2 pcs", 149, 180],
      ["Jeera Cookies", "Unibic", "250 g", 82, 110],
      ["Rusk Elaichi", "Britannia", "300 g", 65, 80],
      ["Burger Buns", "Harvest Gold", "4 pcs", 42, 55],
    ],
  },
  Frozen: {
    subcategory: "Frozen Snacks & Desserts",
    tags: ["frozen", "ice cream", "fries", "snacks"],
    shelfLife: "Keep frozen",
    origin: "Cold chain warehouse",
    items: [
      ["French Fries", "McCain", "420 g", 119, 150],
      ["Aloo Tikki", "McCain", "400 g", 105, 135],
      ["Vanilla Ice Cream Tub", "Kwality Wall's", "700 ml", 199, 240],
      ["Chocolate Ice Cream", "Amul", "750 ml", 185, 225],
      ["Frozen Green Peas", "Safal", "500 g", 89, 110],
      ["Veg Momos", "Prasuma", "24 pcs", 249, 299],
    ],
  },
  "Meat & Eggs": {
    subcategory: "Eggs, Chicken & Fish",
    tags: ["egg", "chicken", "fish", "protein", "non veg"],
    shelfLife: "Use within 2 days",
    origin: "Certified cold chain partner",
    items: [
      ["White Eggs", "Eggoz", "12 pcs", 108, 130],
      ["Chicken Breast Boneless", "Licious", "450 g", 249, 310],
      ["Chicken Curry Cut", "FreshToHome", "500 g", 199, 250],
      ["Rohu Fish Curry Cut", "FreshToHome", "500 g", 269, 330],
      ["Prawns Cleaned", "Licious", "250 g", 299, 360],
      ["Chicken Sausages", "Prasuma", "250 g", 189, 230],
    ],
  },
  Health: {
    subcategory: "Health Foods & Wellness",
    tags: ["health", "protein", "vitamin", "wellness"],
    shelfLife: "Best before 12 months",
    origin: "Wellness distributor",
    items: [
      ["Whey Protein Chocolate", "MuscleBlaze", "500 g", 1099, 1299],
      ["Multivitamin Tablets", "HealthKart", "60 tabs", 399, 499],
      ["ORS Electrolyte", "Electral", "21.8 g", 20, 24],
      ["Green Tea Bags", "Tetley", "50 bags", 185, 230],
      ["Chia Seeds", "True Elements", "250 g", 169, 220],
      ["Honey Natural", "Dabur", "500 g", 199, 240],
    ],
  },
  "Personal Care": {
    subcategory: "Oral, Hair & Hygiene",
    tags: ["personal care", "toothpaste", "shampoo", "hygiene"],
    shelfLife: "Best before 18 months",
    origin: "Personal care distributor",
    items: [
      ["Toothpaste Strong Teeth", "Colgate", "200 g", 106, 130],
      ["Toothbrush Soft", "Oral-B", "2 pcs", 89, 120],
      ["Anti Dandruff Shampoo", "Head & Shoulders", "340 ml", 299, 360],
      ["Hair Oil", "Parachute", "300 ml", 145, 180],
      ["Sanitary Pads XL", "Whisper", "30 pcs", 299, 360],
      ["Deodorant Spray", "Nivea", "150 ml", 199, 249],
    ],
  },
  Stationery: {
    subcategory: "Office & School",
    tags: ["stationery", "pen", "notebook", "office"],
    shelfLife: "No expiry",
    origin: "Stationery distributor",
    items: [
      ["Ball Pens Blue", "Cello", "10 pcs", 75, 100],
      ["A4 Notebook", "Classmate", "172 pages", 72, 90],
      ["Sticky Notes", "Post-it", "100 sheets", 85, 110],
      ["Printer Paper", "JK Copier", "100 sheets", 99, 140],
      ["Permanent Marker", "Camlin", "2 pcs", 60, 80],
      ["Glue Stick", "Fevicol", "25 g", 35, 45],
    ],
  },
  "Paan Corner": {
    subcategory: "Mouth Fresheners",
    tags: ["paan", "mouth freshener", "mint"],
    shelfLife: "Best before 9 months",
    origin: "Paan corner distributor",
    items: [
      ["Mint Mouth Freshener", "Pass Pass", "100 g", 85, 110],
      ["Elaichi", "Tata Sampann", "50 g", 149, 190],
      ["Saunf Mix", "Rajshree", "100 g", 69, 90],
      ["Sugar Free Mint", "Orbit", "22 g", 50, 60],
      ["Clove Pack", "Everest", "50 g", 65, 85],
    ],
  },
  Fashion: {
    subcategory: "Fashion & Footwear",
    tags: ["fashion", "footwear", "men", "women", "kids", "accessories"],
    shelfLife: "No expiry",
    origin: "Fashion partner warehouse",
    items: [
      ["Running Shoes", "Nike", "1 pair", 3299, 4999],
      ["Training T-Shirt", "Adidas", "M size", 899, 1499],
      ["Sneakers", "Puma", "1 pair", 2199, 3499],
      ["Slim Fit Jeans", "Levi", "32 waist", 2499, 3999],
      ["Printed Dress", "Zara", "S size", 1899, 2999],
      ["Cotton Hoodie", "H&M", "L size", 1299, 1999],
    ],
  },
};

const brandedCatalogAdditions = {
  Fresh: [
    ["Avocado Hass", "Fresh Valley", "2 pcs", 189, 240],
    ["Dragon Fruit", "FruitSmith", "1 pc", 145, 190],
    ["Kiwi Green", "Zespri", "3 pcs", 165, 210],
    ["Button Mushroom", "Green Cart", "200 g", 72, 95],
    ["Iceberg Lettuce", "Farm Basket", "1 pc", 58, 80],
    ["Sweet Corn", "Safal", "2 pcs", 52, 70],
  ],
  Dairy: [
    ["Protein Milkshake Chocolate", "Amul", "200 ml", 38, 45],
    ["Probiotic Curd", "Nestle", "400 g", 62, 75],
    ["Cheddar Cheese Block", "Go Cheese", "200 g", 172, 220],
    ["Mishti Doi", "Mother Dairy", "85 g", 28, 35],
    ["Flavoured Milk Badam", "Nandini", "180 ml", 28, 35],
    ["Greek Yogurt Mango", "Epigamia", "90 g", 48, 60],
  ],
  Snacks: [
    ["Kurkure Masala Munch", "Kurkure", "90 g", 35, 45],
    ["Pringles Original", "Pringles", "107 g", 115, 140],
    ["Dark Fantasy Choco Fills", "Sunfeast", "300 g", 142, 170],
    ["Hide & Seek Cookies", "Parle", "200 g", 58, 75],
    ["Oreo Vanilla Cookies", "Cadbury", "120 g", 35, 45],
    ["Peri Peri Makhana", "Farmley", "70 g", 115, 150],
    ["Baked Nachos", "Cornitos", "150 g", 92, 120],
    ["Chocolate Wafer Rolls", "Loacker", "125 g", 189, 230],
  ],
  Drinks: [
    ["Sprite Lime", "Coca-Cola", "750 ml", 40, 45],
    ["Mountain Dew", "Pepsi", "750 ml", 40, 45],
    ["Paper Boat Aamras", "Paper Boat", "250 ml", 32, 40],
    ["Cold Coffee", "Sleepy Owl", "200 ml", 89, 110],
    ["Lemon Iced Tea", "Nestea", "400 ml", 48, 60],
    ["Electrolyte Water", "Fast&Up", "500 ml", 58, 75],
    ["Apple Juice", "B Natural", "1 L", 98, 125],
    ["Sparkling Water", "Perrier", "330 ml", 120, 150],
  ],
  "Instant Food": [
    ["Schezwan Noodles", "Ching's Secret", "240 g", 78, 95],
    ["Instant Pasta Cheese", "Maggi", "64 g", 32, 40],
    ["Ready Dal Fry", "MTR", "300 g", 82, 105],
    ["Ready Rajma Masala", "Tata Sampann", "300 g", 95, 125],
    ["Cup Soup Tomato", "Knorr", "48 g", 58, 75],
    ["Frozen Paratha", "iD Fresh", "400 g", 105, 130],
  ],
  "Home Care": [
    ["Fabric Conditioner", "Comfort", "860 ml", 218, 275],
    ["Disinfectant Spray", "Dettol", "225 ml", 159, 199],
    ["Glass Cleaner", "Colin", "500 ml", 92, 115],
    ["Air Freshener Lavender", "Godrej Aer", "240 ml", 158, 199],
    ["Scrub Pads", "Scotch-Brite", "3 pcs", 68, 85],
    ["Dishwash Bar", "Exo", "700 g", 64, 80],
  ],
  Beauty: [
    ["Vitamin C Serum", "Garnier", "30 ml", 449, 599],
    ["Face Moisturizer", "Cetaphil", "80 g", 429, 499],
    ["Body Lotion Cocoa", "Vaseline", "400 ml", 265, 349],
    ["Micellar Water", "L'Oreal", "95 ml", 155, 199],
    ["Sheet Mask Aloe", "The Face Shop", "1 pc", 82, 110],
    ["Neem Face Wash", "Himalaya", "150 ml", 128, 165],
  ],
  Electronics: [
    ["USB-C Earphones", "boAt", "1 pc", 449, 799],
    ["Power Bank 10000mAh", "Ambrane", "1 pc", 899, 1499],
    ["Wireless Mouse", "Logitech", "1 pc", 599, 899],
    ["HDMI Cable", "Amazon Basics", "1.8 m", 299, 499],
    ["Smart Plug", "Wipro", "1 pc", 699, 999],
    ["Screen Cleaner Kit", "Portronics", "1 kit", 149, 249],
  ],
  "Baby Care": [
    ["Baby Diaper Large", "MamyPoko", "32 pcs", 449, 549],
    ["Baby Shampoo", "Sebamed", "150 ml", 399, 475],
    ["Baby Powder", "Johnson's", "200 g", 145, 185],
    ["Baby Food Rice", "Gerber", "300 g", 285, 335],
    ["Baby Laundry Wash", "Mee Mee", "500 ml", 249, 320],
  ],
  "Pet Care": [
    ["Puppy Food Chicken", "Royal Canin", "1 kg", 780, 900],
    ["Cat Treats Salmon", "Temptations", "85 g", 145, 175],
    ["Dog Biscuits", "Himalaya Healthy Pet", "1 kg", 195, 240],
    ["Wet Cat Food", "Sheba", "85 g", 72, 90],
    ["Pet Bowl Steel", "Heads Up For Tails", "1 pc", 249, 320],
  ],
  Breakfast: [
    ["Protein Bar Choco", "Yoga Bar", "60 g", 85, 100],
    ["Hazelnut Spread", "Nutella", "350 g", 339, 399],
    ["Instant Oats Masala", "Saffola", "500 g", 145, 180],
    ["Granola Dark Chocolate", "True Elements", "450 g", 299, 360],
    ["Pancake Mix", "Betty Crocker", "500 g", 185, 230],
  ],
  Grocery: [
    ["Organic Brown Rice", "24 Mantra", "1 kg", 142, 180],
    ["Cow Ghee", "Amul", "1 L", 635, 720],
    ["Olive Oil Extra Virgin", "Borges", "500 ml", 449, 599],
    ["Poha Thick", "Tata Sampann", "500 g", 58, 75],
    ["Besan", "Fortune", "1 kg", 108, 135],
    ["Premium Tea", "Tata Tea", "1 kg", 455, 520],
    ["Instant Coffee", "Nescafe", "90 g", 299, 340],
    ["Tomato Ketchup", "Kissan", "950 g", 142, 170],
  ],
  Bakery: [
    ["Milk Bread", "Modern", "400 g", 42, 50],
    ["Atta Bread", "Harvest Gold", "450 g", 54, 65],
    ["Chocolate Brownie", "Theobroma", "1 pc", 95, 120],
    ["Digestive Biscuits", "McVitie's", "250 g", 72, 95],
    ["Cup Cakes", "Monginis", "6 pcs", 115, 140],
  ],
  Frozen: [
    ["Frozen Sweet Corn", "Safal", "500 g", 88, 110],
    ["Veg Nuggets", "Yummiez", "400 g", 175, 220],
    ["Chicken Nuggets", "Godrej Yummiez", "400 g", 229, 280],
    ["Mango Ice Cream", "Naturals", "500 ml", 245, 290],
    ["Cheese Burst Pizza", "ITC Master Chef", "360 g", 225, 275],
  ],
  "Personal Care": [
    ["Mouthwash Fresh Mint", "Listerine", "500 ml", 255, 310],
    ["Razor Sensitive", "Gillette", "2 pcs", 189, 240],
    ["Shower Gel Sport", "Nivea", "250 ml", 199, 260],
    ["Hand Sanitizer", "Lifebuoy", "500 ml", 125, 160],
    ["Cotton Buds", "Bella", "100 pcs", 52, 70],
  ],
  Fashion: [
    ["Sports Cap", "Nike", "1 pc", 899, 1299],
    ["Track Pants", "Adidas", "M size", 1499, 2299],
    ["Running Socks", "Puma", "3 pairs", 399, 699],
    ["Denim Jacket", "Levi", "M size", 3299, 4999],
    ["Crossbody Bag", "Zara", "1 pc", 1799, 2699],
    ["Basic T-Shirt Pack", "H&M", "2 pcs", 899, 1499],
  ],
};

Object.entries(brandedCatalogAdditions).forEach(([category, items]) => {
  catalog[category].items.push(...items);
});

const buildProduct = ([name, brand, packSize, price, mrp], category, spec, index) => {
  const discount = Math.max(mrp - price, 0);
  const discountPercent = mrp ? Math.round((discount / mrp) * 100) : 0;
  const slug = slugify(`${brand}-${name}-${packSize}`);
  const image = imageFor(category, name, brand, spec.subcategory);
  const isFresh = ["Fresh", "Dairy", "Bakery", "Meat & Eggs"].includes(category);
  const isNonVeg = ["Meat & Eggs", "Pet Care"].includes(category);

  return {
    name,
    brand,
    slug,
    category,
    subcategory: spec.subcategory,
    description: `${name} from ${brand}, picked for fast neighborhood delivery with live stock and replacement support.`,
    packSize,
    price,
    mrp,
    discountLabel: discountPercent ? `${discountPercent}% OFF` : "Everyday price",
    image,
    gallery: [image, imageFor(category, name, brand, `${spec.subcategory} gallery`)],
    tags: [...new Set([...spec.tags, name.toLowerCase(), brand.toLowerCase(), spec.subcategory.toLowerCase()])],
    variants: [
      { label: packSize, packSize, price, mrp, stock: 18 + ((index * 7) % 42) },
      {
        label: "Value pack",
        packSize: category === "Fresh" ? "1 kg" : "2 pack",
        price: Math.round(price * 1.82),
        mrp: Math.round(mrp * 1.92),
        stock: 8 + ((index * 5) % 22),
      },
    ],
    substitutes: [
      { name: `${brand} alternate`, packSize, price: Math.max(price - 5, 10) },
      { name: `QuickMart ${spec.subcategory} pick`, packSize, price },
    ],
    nutrition: {
      calories: isFresh ? "See pack / naturally low" : `${Math.max(35, Math.round(price / 2))} kcal per serving`,
      protein: ["Dairy", "Meat & Eggs", "Health"].includes(category) ? "Good source" : "See pack",
      carbs: ["Snacks", "Instant Food", "Bakery"].includes(category) ? "Moderate" : "See pack",
      fat: ["Dairy", "Snacks", "Frozen"].includes(category) ? "See pack" : "Low",
      ingredients: `${name}; permitted ingredients and stabilisers where applicable.`,
      allergenInfo: category === "Dairy" ? "Contains milk" : category === "Bakery" ? "May contain gluten" : "Check pack before use",
    },
    reviews: [
      { userName: "Nisha", rating: 5, comment: "Fresh stock and fast delivery." },
      { userName: "Rahul", rating: 4, comment: "Useful pick for daily orders." },
      { userName: "Meera", rating: 5, comment: "Good packing and value." },
    ],
    highlights: [
      isFresh ? "Quality checked morning stock" : "Fast moving item",
      "Packed from nearby dark store",
      "Replacement available on eligible items",
    ],
    shelfLife: spec.shelfLife,
    origin: spec.origin,
    rating: Number((4.1 + ((index % 8) * 0.1)).toFixed(1)),
    reviewCount: 20 + ((index * 13) % 260),
    stock: 12 + ((index * 11) % 88),
    etaMinutes: ["Electronics", "Health", "Stationery"].includes(category) ? 16 : 8 + (index % 7),
    isVeg: !isNonVeg,
    dietaryTags: [
      !isNonVeg ? "vegetarian" : "non-vegetarian",
      ["Fresh", "Grocery", "Health"].includes(category) ? "vegan" : "standard",
      price < 100 ? "budget" : "premium",
    ],
    sponsored: ["Snacks", "Drinks", "Beauty", "Personal Care"].includes(category) && index % 2 === 0,
    regionPrices: {
      Bengaluru: price,
      Mysuru: Math.max(price - 4, 10),
      Hyderabad: price + 3,
    },
    isExpress: true,
    isHandpicked: ["Fresh", "Dairy", "Breakfast", "Beauty", "Health"].includes(category),
    replacementAvailable: category !== "Meat & Eggs",
  };
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const products = Object.entries(catalog).flatMap(([category, spec]) =>
    spec.items.map((item, index) => buildProduct(item, category, spec, index))
  );

  const operations = products.map((product) => ({
    updateOne: {
      filter: { slug: product.slug },
      update: { $set: product },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(operations, { ordered: false });
  const total = await Product.countDocuments();
  const categories = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(`Bulk catalog ready. Upserted ${products.length} products. Total products: ${total}.`);
  console.table(categories.map((item) => ({ category: item._id, products: item.count })));
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
