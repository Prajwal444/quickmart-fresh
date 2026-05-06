const categories = [
  { name: "Fresh", icon: "🥬", accent: "#1f8f5f" },
  { name: "Dairy", icon: "🥛", accent: "#2563eb" },
  { name: "Snacks", icon: "🍿", accent: "#e35d2f" },
  { name: "Drinks", icon: "🧃", accent: "#0891b2" },
  { name: "Instant Food", icon: "🍜", accent: "#c2410c" },
  { name: "Home Care", icon: "🧽", accent: "#7c3aed" },
  { name: "Beauty", icon: "🧴", accent: "#db2777" },
  { name: "Electronics", icon: "🔌", accent: "#334155" },
  { name: "Baby Care", icon: "🧸", accent: "#ca8a04" },
  { name: "Pet Care", icon: "🐾", accent: "#16a34a" },
  { name: "Breakfast", icon: "BF", accent: "#f59e0b" },
  { name: "Grocery", icon: "GR", accent: "#92400e" },
  { name: "Bakery", icon: "BK", accent: "#b45309" },
  { name: "Frozen", icon: "FR", accent: "#0284c7" },
  { name: "Meat & Eggs", icon: "ME", accent: "#be123c" },
  { name: "Health", icon: "HL", accent: "#059669" },
  { name: "Personal Care", icon: "PC", accent: "#7c2d12" },
  { name: "Stationery", icon: "ST", accent: "#4f46e5" },
  { name: "Paan Corner", icon: "PN", accent: "#15803d" },
  { name: "Fashion", icon: "FS", accent: "#111827" },
];

const image = (id) => `https://loremflickr.com/900/700/${String(id).replace(/^photo-/, "grocery-")}?lock=${encodeURIComponent(id)}`;

const products = [
  ["banana-robusta", "Robusta Banana", "Farm Basket", "Fresh", "Fruits", "6 pcs", 48, 65, "26% OFF", image("photo-1603833665858-e61d17a86224"), ["fruit", "banana", "breakfast"], 36],
  ["tomato-local", "Local Tomato", "Farm Basket", "Fresh", "Vegetables", "500 g", 28, 42, "33% OFF", image("photo-1592924357228-91a4daadcfea"), ["vegetable", "tomato"], 28],
  ["amul-toned-milk", "Toned Milk", "Amul", "Dairy", "Milk", "1 L", 68, 72, "Fresh today", image("photo-1563636619-e9143da7973b"), ["milk", "dairy"], 18],
  ["paneer-fresh", "Fresh Paneer", "Milky Mist", "Dairy", "Paneer", "200 g", 96, 120, "20% OFF", image("photo-1631452180519-c014fe946bc7"), ["paneer", "protein"], 11],
  ["lays-classic", "Classic Salted Chips", "Lay's", "Snacks", "Chips", "52 g", 20, 20, "Buy 2", image("photo-1566478989037-eec170784d0b"), ["chips", "snack"], 42],
  ["bingo-mad-angles", "Mad Angles Achari", "Bingo", "Snacks", "Chips", "72 g", 36, 50, "28% OFF", image("photo-1613919113640-25732ec5e61f"), ["chips", "spicy"], 30],
  ["coke-zero", "Coca-Cola Zero", "Coca-Cola", "Drinks", "Soda", "750 ml", 42, 45, "Chilled", image("photo-1622483767028-3f66f32aef97"), ["cola", "cold drink"], 24],
  ["tropicana-orange", "Orange Juice", "Tropicana", "Drinks", "Juice", "1 L", 105, 135, "22% OFF", image("photo-1600271886742-f049cd451bba"), ["juice", "breakfast"], 17],
  ["maggi-noodles", "2-Minute Masala Noodles", "Maggi", "Instant Food", "Noodles", "560 g", 108, 120, "10% OFF", image("photo-1585032226651-759b368d7246"), ["noodles", "instant"], 44],
  ["id-fresh-batter", "Idli Dosa Batter", "iD Fresh", "Instant Food", "Ready to cook", "1 kg", 88, 95, "Fresh pack", image("photo-1630383249896-424e482df921"), ["breakfast", "batter"], 14],
  ["surf-excel", "Liquid Detergent", "Surf Excel", "Home Care", "Laundry", "1 L", 199, 240, "17% OFF", image("photo-1626806787461-102c1bfaaea1"), ["detergent", "home"], 21],
  ["vim-dishwash", "Dishwash Gel Lemon", "Vim", "Home Care", "Cleaning", "750 ml", 145, 180, "19% OFF", image("photo-1585421514284-efb74c2b69ba"), ["dishwash", "home"], 25],
  ["dove-bodywash", "Deep Moisture Body Wash", "Dove", "Beauty", "Bath", "250 ml", 185, 260, "29% OFF", image("photo-1556228720-195a672e8a03"), ["beauty", "bath"], 16],
  ["nivea-cream", "Soft Light Moisturizer", "Nivea", "Beauty", "Skin care", "200 ml", 210, 299, "30% OFF", image("photo-1611930022073-b7a4ba5fcccd"), ["cream", "beauty"], 12],
  ["usb-c-cable", "Braided USB-C Cable", "QuickBits", "Electronics", "Accessories", "1 m", 149, 299, "50% OFF", image("photo-1603539444875-76e7684265f6"), ["cable", "phone"], 9],
  ["aa-batteries", "AA Alkaline Batteries", "Duracell", "Electronics", "Batteries", "4 pcs", 159, 220, "28% OFF", image("photo-1619641805634-b867f5350717"), ["battery", "electronics"], 18],
  ["baby-wipes", "Gentle Baby Wipes", "Huggies", "Baby Care", "Wipes", "72 wipes", 115, 150, "23% OFF", image("photo-1583947215259-38e31be8751f"), ["baby", "wipes"], 20],
  ["pedigree-chicken", "Chicken Dog Food", "Pedigree", "Pet Care", "Dog food", "1.2 kg", 245, 310, "21% OFF", image("photo-1589924691995-400dc9ecc119"), ["pet", "dog"], 15],
];

module.exports = { categories, products };
