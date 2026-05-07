import {
  BadgeIndianRupee,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  Gift,
  Headphones,
  Heart,
  Home,
  LayoutDashboard,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  PackageCheck,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TicketPercent,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const api = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
};

const navItems = [
  { key: "home", label: "Instashop", icon: Home },
  { key: "search", label: "Search", icon: Search },
  { key: "categories", label: "Categories", icon: Store },
  { key: "handpicked", label: "Handpicked", icon: Sparkles },
  { key: "wishlist", label: "Wishlist", icon: Heart },
  { key: "orders", label: "Reorder", icon: RotateCcw },
  { key: "driver", label: "Driver", icon: Truck },
  { key: "features", label: "Features", icon: Check },
  { key: "account", label: "Account", icon: UserRound },
  { key: "support", label: "Support", icon: Headphones },
];

const fallbackCoupons = [
  { code: "FRESH75", title: "Flat Rs 75 off", detail: "On orders above Rs 499" },
  { code: "SNACKS20", title: "20% off snacks", detail: "Auto-applies on eligible chips and drinks" },
  { code: "FREESHIP", title: "Free delivery", detail: "Unlocks delivery fee waiver" },
];

const mutableOrderStatuses = ["Placed", "Packing", "Out for delivery"];
const canChangeOrder = (order) => mutableOrderStatuses.includes(order?.status);
const safeOrderTimeline = (order) =>
  Array.isArray(order?.timeline) && order.timeline.length
    ? order.timeline
    : [{ label: order?.status || "Order status", time: "Now", done: true }];
const safeOrderItems = (order) => (Array.isArray(order?.items) ? order.items : []);
const shortOrderId = (order) => String(order?._id || "ORDER").slice(-6).toUpperCase();
const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const needsSizeSelection = (product) =>
  String(product?.category || "").toLowerCase() === "fashion" ||
  /\b(size|dress|shirt|jeans|jacket|kurta|top|tee|t-shirt|cloth)\b/i.test(
    `${product?.name || ""} ${product?.packSize || ""} ${product?.subcategory || ""}`
  );
const cartLineKey = (productId, selectedSize = "") => `${productId}${selectedSize ? `::${selectedSize}` : ""}`;

const cartProductId = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const deliverySlots = ["8-12 minutes", "15-20 minutes", "Schedule 7:00 AM", "Schedule 9:00 PM"];

const addressPresets = {
  Koramangala: {
    label: "Home",
    line1: "QuickMart sample home, 5th Block",
    pincode: "560034",
    instructions: "Leave at door if I do not answer",
  },
  Indiranagar: {
    label: "Office",
    line1: "QuickMart sample office, 100 Feet Road",
    pincode: "560038",
    instructions: "Call on arrival at reception",
  },
  HSR: {
    label: "Home",
    line1: "QuickMart sample apartment, HSR Layout Sector 2",
    pincode: "560102",
    instructions: "Ring the bell once",
  },
  "Mysuru Central": {
    label: "Home",
    line1: "QuickMart sample address, Devaraja Mohalla",
    pincode: "570001",
    instructions: "Deliver to security desk",
  },
  "Remote Area": {
    label: "Other",
    line1: "Outside current delivery coverage",
    pincode: "560000",
    instructions: "Serviceability unavailable for this demo zone",
  },
};

const distanceBetweenCoords = (first, second) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLon = toRadians(second.longitude - first.longitude);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function App() {
  const [homeData, setHomeData] = useState(null);
  const [serviceZones, setServiceZones] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quickmart_location"));
    } catch {
      return null;
    }
  });
  const [products, setProducts] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 24, total: 0, loaded: 0, hasMore: true });
  const [availableBrandFilters, setAvailableBrandFilters] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isMoreProductsLoading, setIsMoreProductsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeView, setActiveView] = useState("home");
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quickmart_cart")) || [];
    } catch {
      return [];
    }
  });
  const [quote, setQuote] = useState(null);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [ratingOrder, setRatingOrder] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [paymentMode, setPaymentMode] = useState("upi");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isAddressOpen, setIsAddressOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [deliverySlot, setDeliverySlot] = useState(deliverySlots[0]);
  const [deliveryInstruction, setDeliveryInstruction] = useState("Ring the bell once");
  const [replacementChoice, setReplacementChoice] = useState("Call before replacing unavailable items");
  const [availableCoupons, setAvailableCoupons] = useState(fallbackCoupons);
  const [sortMode, setSortMode] = useState("relevance");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState(500);
  const [dietaryFilter, setDietaryFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [discountFilter, setDiscountFilter] = useState(0);
  const [deliveryFilter, setDeliveryFilter] = useState(0);
  const [brandFilters, setBrandFilters] = useState([]);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [driverConsole, setDriverConsole] = useState(null);
  const [deliveryProofPin, setDeliveryProofPin] = useState("");
  const [autocompleteItems, setAutocompleteItems] = useState([]);
  const [walletHistory, setWalletHistory] = useState(null);
  const [authStartMode, setAuthStartMode] = useState("emailOtp");
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);
  const [paymentRecovery, setPaymentRecovery] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quickmart_recently_viewed")) || [];
    } catch {
      return [];
    }
  });
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("quickmart_recent_searches")) || [];
    } catch {
      return [];
    }
  });
  const productRequestRef = useRef(0);
  const loadMoreRef = useRef(null);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const categories = homeData?.categories || [];
  const currentLocation = selectedLocation || homeData?.location;
  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.key === "driver") return user?.role === "admin" || user?.role === "driver";
        if (item.key === "features") return user?.role === "admin";
        return true;
      }),
    [user]
  );
  const visibleProducts = products;
  const cartQuantityByProduct = useMemo(
    () =>
      cart.reduce((map, item) => {
        const productId = cartProductId(item.product);
        map[productId] = (map[productId] || 0) + item.quantity;
        map[item.cartKey || cartLineKey(productId, item.selectedSize)] = item.quantity;
        return map;
      }, {}),
    [cart]
  );
  const wishlistIds = useMemo(
    () => new Set((wishlistProducts || []).map((item) => item._id || item)),
    [wishlistProducts]
  );

  const suggestions = useMemo(() => {
    if (!query.trim()) {
      return [
        { name: "Toned Milk", brand: "Amul", category: "Dairy", price: 68, etaMinutes: 9 },
        { name: "Robusta Banana", brand: "Farm Basket", category: "Fresh", price: 48, etaMinutes: 9 },
        { name: "Classic Salted Chips", brand: "Lay's", category: "Snacks", price: 20, etaMinutes: 9 },
        { name: "Liquid Detergent", brand: "Surf Excel", category: "Home Care", price: 199, etaMinutes: 9 },
      ];
    }
    return autocompleteItems;
  }, [autocompleteItems, query]);

  const loadHome = async () => {
    const data = await api("/api/home");
    setHomeData(data);
  };

  const applyLocation = (location) => {
    const displayArea = location.displayArea || location.displayName || location.area;
    const nextLocation = {
      label: location.label || `Delivering to ${displayArea}`,
      area: location.displayArea || location.displayName
        ? displayArea
        : location.city && !String(location.area).includes(location.city)
          ? `${location.area}, ${location.city}`
          : location.area,
      eta: location.available === false
        ? "Unavailable"
        : typeof location.eta === "number"
          ? `${location.eta} mins`
          : location.eta || `${location.etaMinutes || 10} mins`,
      available: location.available !== false,
    };
    setSelectedLocation(nextLocation);
    setHomeData((data) => (data ? { ...data, location: nextLocation } : data));
    localStorage.setItem("quickmart_location", JSON.stringify(nextLocation));
    if (nextLocation.available) {
      if (activeView === "outOfService") setActiveView("home");
      setMessage(`Delivery location set to ${nextLocation.area}`);
      return;
    }
    setActiveView("outOfService");
    setMessage("");
  };

  const loadProducts = async ({ page = 1, append = false } = {}) => {
    const requestId = ++productRequestRef.current;
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", 24);
    if (query) params.set("q", query);
    if (activeCategory !== "All") params.set("category", activeCategory);
    if (activeView === "handpicked") params.set("handpicked", "true");
    if (dietaryFilter !== "all") params.set("dietary", dietaryFilter);
    if (minRating) params.set("rating", minRating);
    if (onlyInStock) params.set("inStock", "true");
    if (maxPrice !== 500) params.set("maxPrice", maxPrice);
    if (discountFilter) params.set("discount", discountFilter);
    if (deliveryFilter) params.set("deliveryEta", deliveryFilter);
    if (brandFilters.length) params.set("brands", brandFilters.join(","));
    if (sortMode !== "relevance") params.set("sort", sortMode);

    if (append) setIsMoreProductsLoading(true);
    else setIsProductsLoading(true);

    try {
      const data = await api(`/api/products?${params}`);
      if (requestId !== productRequestRef.current) return;
      setProducts((current) => {
        if (!append) return data.products || [];
        const seen = new Set(current.map((item) => item._id));
        return [...current, ...(data.products || []).filter((item) => !seen.has(item._id))];
      });
      setProductPagination(data.pagination || { page, limit: 24, total: data.products?.length || 0, loaded: data.products?.length || 0, hasMore: false });
      setAvailableBrandFilters(data.filters?.availableBrands || []);
    } finally {
      if (requestId === productRequestRef.current) {
        setIsProductsLoading(false);
        setIsMoreProductsLoading(false);
      }
    }
  };

  const loadMoreProducts = () => {
    if (isProductsLoading || isMoreProductsLoading || !productPagination.hasMore) return;
    loadProducts({ page: productPagination.page + 1, append: true }).catch((error) => setMessage(error.message));
  };

  const resetProductFilters = () => {
    setActiveCategory("All");
    setSortMode("relevance");
    setOnlyInStock(false);
    setMaxPrice(500);
    setDietaryFilter("all");
    setMinRating(0);
    setDiscountFilter(0);
    setDeliveryFilter(0);
    setBrandFilters([]);
  };

  const runSearch = (term = query) => {
    const cleanTerm = term.trim();
    setQuery(cleanTerm);
    setActiveView("search");

    if (cleanTerm) {
      setRecentSearches((items) => {
        const next = [cleanTerm, ...items.filter((item) => item !== cleanTerm)].slice(0, 8);
        localStorage.setItem("quickmart_recent_searches", JSON.stringify(next));
        return next;
      });
    }
  };

  const loadOrders = async () => {
    if (!user) return;
    const data = await api("/api/orders");
    setOrders(data.orders);
  };

  const loadAdmin = async () => {
    if (user?.role !== "admin") return;
    const data = await api("/api/admin/summary");
    setAdminSummary(data);
  };

  const loadWishlist = async () => {
    if (!user) {
      setWishlistProducts([]);
      return;
    }
    const data = await api("/api/me/wishlist");
    setWishlistProducts(data.products || []);
  };

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const data = await api("/api/me/notifications");
    setNotifications(data.notifications || []);
  };

  const markNotificationsRead = async () => {
    if (!user) return;
    const data = await api("/api/me/notifications/read", { method: "PATCH" });
    setNotifications(data.notifications || []);
    setMessage("Notifications marked as read");
  };

  const loadWalletHistory = async () => {
    if (!user) {
      setWalletHistory(null);
      return;
    }
    const data = await api("/api/me/wallet/history");
    setWalletHistory(data);
  };

  const loadRecommendations = async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (cart.length) params.set("cart", cart.map((item) => cartProductId(item.product)).filter(Boolean).join(","));
    const data = await api(`/api/recommendations?${params}`);
    setRecommendations(data);
  };

  const loadDriverConsole = async () => {
    if (!user) return;
    const data = await api("/api/delivery/console");
    setDriverConsole(data);
  };

  const topUpWallet = async (amount = 200) => {
    if (!user) {
      await login("customer");
      return;
    }

    const data = await api("/api/me/wallet", {
      method: "PATCH",
      body: JSON.stringify({ amount }),
    });
    setUser(data.user);
    setMessage(`Wallet topped up by ${currency.format(amount)}`);
  };

  const raiseSupportIssue = async (order, issue) => {
    if (!order) return;
    const data = await api(`/api/orders/${order._id}/support`, {
      method: "PATCH",
      body: JSON.stringify({ issue }),
    });
    setOrders((existing) =>
      existing.map((item) => (item._id === data.order._id ? data.order : item))
    );
    setSelectedOrder(data.order);
    setMessage("Support request added to order");
  };

  useEffect(() => {
    loadHome().catch((error) => setMessage(error.message));
    api("/api/coupons")
      .then((data) => setAvailableCoupons(data.coupons || fallbackCoupons))
      .catch(() => {});
    api("/api/serviceability/zones")
      .then((data) => setServiceZones(data.zones || []))
      .catch(() => setServiceZones([]));
    api("/api/me")
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setProducts([]);
    setProductPagination({ page: 1, limit: 24, total: 0, loaded: 0, hasMore: true });
    loadProducts({ page: 1 }).catch((error) => setMessage(error.message));
  }, [query, activeCategory, activeView, dietaryFilter, minRating, onlyInStock, maxPrice, discountFilter, deliveryFilter, brandFilters, sortMode]);

  useEffect(() => {
    const marker = loadMoreRef.current;
    if (!marker) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreProducts();
      },
      { root: null, rootMargin: "520px 0px", threshold: 0.01 }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [productPagination.hasMore, productPagination.page, isProductsLoading, isMoreProductsLoading, products.length]);

  useEffect(() => {
    if (!brandFilters.length) return;
    if (!availableBrandFilters.length) {
      setBrandFilters([]);
      return;
    }
    const available = new Set(availableBrandFilters.map((brand) => brand.toLowerCase()));
    const next = brandFilters.filter((brand) => available.has(brand.toLowerCase()));
    if (next.length !== brandFilters.length) setBrandFilters(next);
  }, [availableBrandFilters, brandFilters]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setAutocompleteItems([]);
      return;
    }

    const timer = setTimeout(() => {
      api(`/api/products?q=${encodeURIComponent(term)}`)
        .then((data) => setAutocompleteItems((data.products || []).slice(0, 8)))
        .catch(() => setAutocompleteItems([]));
    }, 140);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    localStorage.setItem("quickmart_cart", JSON.stringify(cart));
    api("/api/cart/quote", {
      method: "POST",
      body: JSON.stringify({ items: cart, coupon }),
    })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [cart, coupon]);

  useEffect(() => {
    loadOrders().catch(() => {});
    loadAdmin().catch(() => {});
    loadWishlist().catch(() => {});
    loadNotifications().catch(() => {});
    loadWalletHistory().catch(() => {});
  }, [user]);

  useEffect(() => {
    loadRecommendations().catch(() => {});
  }, [cart, query]);

  useEffect(() => {
    if (activeView === "driver") loadDriverConsole().catch(() => {});
  }, [activeView, user]);

  useEffect(() => {
    if (activeView === "driver" && user?.role !== "admin" && user?.role !== "driver") {
      setActiveView("home");
    }
    if (activeView === "features" && user?.role !== "admin") {
      setActiveView("home");
    }
  }, [activeView, user]);

  const login = async (role = "customer", nextView = "") => {
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: role === "admin" ? "admin@quickmart.test" : "customer@quickmart.test",
          password: role === "admin" ? "admin123" : "customer123",
        }),
      });
      setUser(data.user);
      setActiveView(nextView || (data.user.role === "admin" ? "admin" : "home"));
      setMessage(`Logged in as ${data.user.name}`);
      return data.user;
    } catch (error) {
      setMessage(error.message);
      return null;
    }
  };

  const loginWithOtp = async () => {
    const data = await api("/api/auth/otp", {
      method: "POST",
      body: JSON.stringify({ phone: "9000000002", otp: "123456" }),
    });
    setUser(data.user);
    setMessage("OTP login completed with demo code 123456");
  };

  const requestEmailOtp = async (email, name) => {
    const data = await api("/api/auth/email-otp/request", {
      method: "POST",
      body: JSON.stringify({ email, name, purpose: "login" }),
    });
    setMessage(data.message);
    return data;
  };

  const verifyEmailOtp = async (email, otp, name, phone) => {
    const data = await api("/api/auth/email-otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, otp, name, phone }),
    });
    setUser(data.user);
    setMessage("Email OTP verified and logged in");
  };

  const signupWithEmail = async (payload) => {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setUser(data.user);
    setMessage(`Signup complete for ${data.user.name}`);
  };

  const loginSocial = async (provider) => {
    const data = await api("/api/auth/social", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
    setUser(data.user);
    setMessage(`${provider} demo login completed`);
  };

  const openAuth = (mode = "emailOtp") => {
    setAuthStartMode(mode);
    setActiveView("account");
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOrders([]);
    setAdminSummary(null);
    setWishlistProducts([]);
    setNotifications([]);
    setWalletHistory(null);
  };

  const openProduct = (product) => {
    setSelectedProduct(product);
    setRecentlyViewed((items) => {
      const next = [product, ...items.filter((item) => item._id !== product._id)].slice(0, 6);
      localStorage.setItem("quickmart_recently_viewed", JSON.stringify(next));
      return next;
    });
  };

  const toggleWishlist = async (product) => {
    if (!user) {
      await login("customer");
    }
    const data = await api(`/api/me/wishlist/${product._id}`, { method: "PATCH" });
    setUser(data.user);
    await loadWishlist();
    setMessage(data.saved ? `${product.name} saved to wishlist` : `${product.name} removed from wishlist`);
  };

  const addAddress = async (address) => {
    if (!user) {
      await login("customer");
      return;
    }
    const data = await api("/api/me/addresses", {
      method: "POST",
      body: JSON.stringify(address),
    });
    setUser(data.user);
    setMessage("Address added");
  };

  const updateAddress = async (addressId, address) => {
    const data = await api(`/api/me/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify(address),
    });
    setUser(data.user);
    setMessage("Address updated");
  };

  const deleteAddress = async (addressId) => {
    const data = await api(`/api/me/addresses/${addressId}`, { method: "DELETE" });
    setUser(data.user);
    setMessage("Address deleted");
  };

  const addReview = async (product, review) => {
    if (!user) {
      await login("customer");
    }
    const data = await api(`/api/products/${product._id}/reviews`, {
      method: "POST",
      body: JSON.stringify(review),
    });
    setSelectedProduct(data.product);
    await loadProducts();
    setMessage("Review added");
  };

  const cancelOrder = async (order) => {
    const data = await api(`/api/orders/${order._id}/cancel`, { method: "PATCH" });
    setSelectedOrder(data.order);
    setOrders((existing) => existing.map((entry) => (entry._id === data.order._id ? data.order : entry)));
    await loadOrders();
    setMessage("Order cancelled and refund flow started if needed");
  };

  const rateDelivery = async (order, feedback) => {
    const data = await api(`/api/orders/${order._id}/rating`, {
      method: "PATCH",
      body: JSON.stringify(feedback),
    });
    setOrders((existing) => existing.map((entry) => (entry._id === data.order._id ? data.order : entry)));
    setRatingOrder(null);
    await loadOrders();
    setMessage(`Delivery rated ${feedback.rating} stars`);
  };

  const modifyOrderItem = async (order, item, nextQuantity) => {
    const data = await api(`/api/orders/${order._id}/modify`, {
      method: "PATCH",
      body: JSON.stringify({ product: item.product, quantity: nextQuantity }),
    });
    setOrders((existing) => existing.map((entry) => (entry._id === data.order._id ? data.order : entry)));
    setSelectedOrder((current) => (current?._id === data.order._id ? data.order : current));
    setMessage("Order modified before delivery");
  };

  const updateReplacementPolicy = async (order, replacementPolicy) => {
    const data = await api(`/api/orders/${order._id}/replacement`, {
      method: "PATCH",
      body: JSON.stringify({ replacementPolicy }),
    });
    setOrders((existing) => existing.map((entry) => (entry._id === data.order._id ? data.order : entry)));
    setSelectedOrder((current) => (current?._id === data.order._id ? data.order : current));
    setMessage("Replacement preference updated");
  };

  const submitDeliveryProof = async (order) => {
    const data = await api(`/api/delivery/orders/${order._id}/proof`, {
      method: "PATCH",
      body: JSON.stringify({ pin: deliveryProofPin, proof: "PIN verified by delivery partner" }),
    });
    setDeliveryProofPin("");
    setMessage(`Delivered #${shortOrderId(data.order)} with proof`);
    await loadDriverConsole();
    await loadOrders();
  };

  const showInvoice = async (order) => {
    const data = await api(`/api/orders/${order._id}/invoice`);
    setInvoiceData(data.invoice);
  };

  const updatePreferences = async (preferences) => {
    const data = await api("/api/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences),
    });
    setUser(data.user);
    setMessage("Preferences updated");
  };

  const updateProfile = async (profile) => {
    const data = await api("/api/me/profile", {
      method: "PATCH",
      body: JSON.stringify(profile),
    });
    setUser(data.user);
    setMessage("Profile updated");
  };

  const changeContactWithOtp = async (contact) => {
    await api("/api/me/contact/otp", {
      method: "POST",
      body: JSON.stringify(contact),
    });
    const data = await api("/api/me/contact", {
      method: "PATCH",
      body: JSON.stringify({ ...contact, otp: "123456" }),
    });
    setUser(data.user);
    setMessage("Contact changed with demo OTP 123456");
  };

  const requestEmailChangeOtp = async (email) => {
    const data = await api("/api/me/email-change/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setMessage(data.message);
    return data;
  };

  const verifyEmailChangeOtp = async (email, otp) => {
    const data = await api("/api/me/email-change/verify", {
      method: "PATCH",
      body: JSON.stringify({ email, otp }),
    });
    setUser(data.user);
    setMessage(data.message || "Email changed after OTP verification");
    return data;
  };

  const deactivateAccount = async () => {
    await api("/api/me/deactivate", { method: "PATCH" });
    setUser(null);
    setOrders([]);
    setMessage("Account deactivated");
  };

  const updatePrivacy = async (settings) => {
    const data = await api("/api/me/privacy", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
    setUser(data.user);
    setMessage("Security and privacy settings updated");
  };

  const deleteAccount = async () => {
    await api("/api/me", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    setUser(null);
    setMessage("Demo account deleted");
  };

  const addToCart = (product, quantity = 1, options = {}) => {
    const selectedSize = options.selectedSize || "";
    const lineKey = cartLineKey(product._id, selectedSize);
    setCart((items) => {
      const existing = items.find((item) => (item.cartKey || cartLineKey(item.product, item.selectedSize)) === lineKey);
      if (existing) {
        return items.map((item) =>
          (item.cartKey || cartLineKey(item.product, item.selectedSize)) === lineKey
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      }

      return [
        ...items,
        {
          product: product._id,
          cartKey: lineKey,
          selectedSize,
          quantity,
          name: product.name,
          brand: product.brand,
          category: product.category,
          image: product.image,
          price: product.price,
          mrp: product.mrp,
          stock: product.stock,
          packSize: selectedSize ? `${selectedSize} size` : product.packSize,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const updateCart = (product, quantity) => {
    const target = String(product);
    setCart((items) =>
      quantity <= 0
        ? items.filter((item) => {
            const productId = cartProductId(item.product);
            const itemKey = String(item.cartKey || cartLineKey(productId, item.selectedSize));
            return productId !== target && itemKey !== target;
          })
        : items.map((item) =>
            {
              const productId = cartProductId(item.product);
              const itemKey = String(item.cartKey || cartLineKey(productId, item.selectedSize));
              return productId === target || itemKey === target
                ? {
                    ...item,
                    product: productId || item.product,
                    quantity: Number(item.stock) > 0 ? Math.min(quantity, Number(item.stock)) : quantity,
                  }
                : item;
            }
          )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCoupon("");
    setMessage("Cart cleared");
  };

  const moveCartItemToWishlist = async (item) => {
    const productId = cartProductId(item.product || item._id);
    const lineKey = String(item.cartKey || productId);
    if (!productId) return;

    if (!user) {
      const loggedInUser = await login("customer");
      if (!loggedInUser) return;
    }

    try {
      const data = await api(`/api/me/wishlist/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ saved: true }),
      });
      setUser(data.user);
      setWishlistProducts(data.products || data.wishlist || []);
      updateCart(lineKey, 0);
      setMessage(`${item.name} moved to wishlist`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const saveCartForLater = async () => {
    if (!cart.length) return;
    if (!user) {
      const loggedInUser = await login("customer");
      if (!loggedInUser) return;
    }

    try {
      const productIds = [...new Set(cart.map((item) => cartProductId(item.product)).filter(Boolean))];
      if (!productIds.length) {
        clearCart();
        return;
      }
      const responses = await Promise.all(
        productIds.map((productId) =>
          api(`/api/me/wishlist/${productId}`, {
            method: "PATCH",
            body: JSON.stringify({ saved: true }),
          })
        )
      );
      const latest = responses[responses.length - 1];
      setUser(latest?.user || user);
      setWishlistProducts(latest?.products || latest?.wishlist || []);
      setCart([]);
      setCoupon("");
      setMessage(`${productIds.length} products saved for later`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const placeOrder = async () => {
    if (!user) {
      const loggedInUser = await login("customer");
      if (!loggedInUser) return;
    }

    if (simulatePaymentFailure && paymentMode !== "cod") {
      setPaymentRecovery({
        title: "Payment could not be completed",
        body: "No order was created. Switch payment mode or retry after checking the payment app.",
      });
      setMessage("Payment failed safely. Try COD, wallet, or retry.");
      return;
    }

    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart,
          paymentMode,
          deliverySlot: `Arriving in ${deliverySlot}`,
          address: user?.addresses?.[0],
          notes: {
            coupon,
            deliveryInstruction,
            replacementChoice,
          },
        }),
      });

      setCart([]);
      setPaymentRecovery(null);
      setSimulatePaymentFailure(false);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      setActiveView("orders");
      setMessage(`Order ${shortOrderId(order.order)} placed`);
      await loadOrders();
      await loadNotifications();
    } catch (error) {
      setMessage(error.message);
      setPaymentRecovery({
        title: "Order could not be placed",
        body: error.message,
      });
    }
  };

  return (
    <div className="appShell">
      {message && (
        <button className="toast" onClick={() => setMessage("")}>
          {message}
          <X size={16} />
        </button>
      )}

      <header className="topbar">
        <div className="brandBlock">
          <div className="brandMark">Q</div>
          <div>
            <strong>QuickMart Fresh</strong>
            <button className="locationButton" title={currentLocation?.area || "Choose delivery location"} onClick={() => setIsAddressOpen(true)}>
              <LocateFixed size={15} />
              {currentLocation?.area || "Choose delivery location"}
              <ChevronDown size={15} />
            </button>
          </div>
        </div>

        <div className="searchBox">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setActiveView("search")}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
            placeholder="Search for milk, chips, fruits, batteries..."
          />
          <button className="searchSubmit" onClick={() => runSearch()}>
            Search
          </button>
          <div className="suggestions">
            {suggestions.map((item) => (
              <button
                key={`${item.name}-${item.brand || item.category}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  runSearch(item.name);
                }}
              >
                <Search size={15} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.brand || item.category} · {item.category || "Popular"} · {currency.format(item.price || 0)} · {item.etaMinutes || 10} min</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="headerActions">
          <button className="iconButton notificationButton" onClick={() => setIsNotificationsOpen(true)}>
            <Bell size={19} />
            {notifications?.some((item) => !item.read) && <span>{notifications.filter((item) => !item.read).length}</span>}
          </button>
          {user ? (
            <>
              <button className="accountPill userPill" onClick={() => setActiveView("account")} title="Open account profile">
                <UserRound size={18} />
                <span>
                  <strong>{user.name.split(" ")[0]}</strong>
                  <small>{user.role === "admin" ? "Admin profile" : "My account"}</small>
                </span>
              </button>
              <button className="logoutButton" onClick={logout} title="Logout from this account">
                <LogOut size={18} />
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="accountPill" onClick={() => openAuth("emailOtp")}>
                <UserRound size={18} />
                Login
              </button>
              <button className="adminMini" onClick={() => openAuth("signup")}>
                Register
              </button>
              <button className="adminMini" onClick={() => login("admin", "admin")}>
                Admin
              </button>
            </>
          )}
          <button className="cartButton" onClick={() => setIsCartOpen(true)}>
            <ShoppingBag size={19} />
            {cartCount ? `${cartCount} items` : "Cart"}
          </button>
        </div>
      </header>

      <section className="mobileHero">
        <button title={currentLocation?.area || "Choose delivery location"} onClick={() => setIsAddressOpen(true)}>
          <MapPin size={18} />
          Deliver to {currentLocation?.area || user?.addresses?.[0]?.area || "current location"}
        </button>
        <button onClick={() => setActiveView("orders")}>
          <Navigation size={18} />
          Track order
        </button>
      </section>

      <main className="mainGrid">
        <aside className="categoryRail">
          <button
            className={activeCategory === "All" ? "categoryItem active" : "categoryItem"}
            onClick={() => setActiveCategory("All")}
          >
            <span>All</span>
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              className={activeCategory === category.name ? "categoryItem active" : "categoryItem"}
              onClick={() => {
                setActiveCategory(category.name);
                setActiveView("categories");
              }}
            >
              <span>{category.icon}</span>
              {category.name}
            </button>
          ))}
        </aside>

        <section className="content">
          <div className="deliveryStrip">
            <span>
              <Clock3 size={18} />
              Delivery in {currentLocation?.eta || "10 mins"}
            </span>
            <span>
              <ShieldCheck size={18} />
              Replacement available on eligible items
            </span>
            <span>
              <WalletCards size={18} />
              QuickPass savings applied at checkout
            </span>
          </div>

          {activeView === "outOfService" ? (
            <OutOfServiceView
              location={currentLocation}
              zones={serviceZones}
              chooseLocation={() => setIsAddressOpen(true)}
              chooseZone={applyLocation}
            />
          ) : activeView === "home" && (
            <>
              <section className="quickActions">
                <button onClick={() => setActiveView("categories")}>
                  <SlidersHorizontal size={18} />
                  Browse all categories
                </button>
                <button onClick={() => setActiveView("orders")}>
                  <ReceiptText size={18} />
                  Past orders and reorder
                </button>
                <button onClick={() => setIsCartOpen(true)}>
                  <ShoppingBag size={18} />
                  Open cart
                </button>
                <button onClick={() => setActiveView("support")}>
                  <Headphones size={18} />
                  Help and refunds
                </button>
              </section>

              <section className="heroBand">
                {homeData?.banners?.map((banner) => (
                  <article className={`promoCard ${banner.tone}`} key={banner.title}>
                    <p>{banner.cta}</p>
                    <h1>{banner.title}</h1>
                    <span>{banner.subtitle}</span>
                  </article>
                ))}
              </section>

              <section className="sectionHeader">
                <h2>Shop by moment</h2>
                <p>Everything from top-ups to weekly restock, packed from nearby stores.</p>
              </section>

              <div className="categoryTiles">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    style={{ "--accent": category.accent }}
                    onClick={() => {
                      setActiveCategory(category.name);
                      setActiveView("categories");
                    }}
                  >
                    <span>{category.icon}</span>
                    <strong>{category.name}</strong>
                    <small>Up to 50% off</small>
                  </button>
                ))}
              </div>

              <section className="couponStrip">
                {availableCoupons.map((item) => (
                  <button
                    key={item.code}
                    className={coupon === item.code ? "coupon selected" : "coupon"}
                    onClick={() => {
                      setCoupon(item.code);
                      setMessage(`${item.code} applied`);
                    }}
                  >
                    <TicketPercent size={20} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.code} · {item.detail}</small>
                    </span>
                  </button>
                ))}
              </section>
              <DiscoveryShelf title="Buy again" products={homeData?.buyAgain || orders[0]?.items || []} addToCart={addToCart} openProduct={openProduct} />
              <DiscoveryShelf title="Trending now near you" products={homeData?.trending || []} addToCart={addToCart} openProduct={openProduct} />
              <DiscoveryShelf title="Sponsored brand promotions" products={homeData?.sponsored || []} addToCart={addToCart} openProduct={openProduct} />
              <DiscoveryShelf title="Recently viewed" products={recentlyViewed} addToCart={addToCart} openProduct={openProduct} />
            </>
          )}

          {activeView === "outOfService" ? null : activeView === "search" ? (
            <SearchView
              products={visibleProducts}
              query={query}
              recentSearches={recentSearches}
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              sortMode={sortMode}
              setSortMode={setSortMode}
              onlyInStock={onlyInStock}
              setOnlyInStock={setOnlyInStock}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              dietaryFilter={dietaryFilter}
              setDietaryFilter={setDietaryFilter}
              minRating={minRating}
              setMinRating={setMinRating}
              discountFilter={discountFilter}
              setDiscountFilter={setDiscountFilter}
              deliveryFilter={deliveryFilter}
              setDeliveryFilter={setDeliveryFilter}
              brandFilters={brandFilters}
              setBrandFilters={setBrandFilters}
              availableBrandFilters={availableBrandFilters}
              resetProductFilters={resetProductFilters}
              runSearch={runSearch}
              addToCart={addToCart}
              updateCart={updateCart}
              cartQuantityByProduct={cartQuantityByProduct}
              openProduct={openProduct}
              toggleWishlist={toggleWishlist}
              wishlistIds={wishlistIds}
              loading={isProductsLoading}
              loadingMore={isMoreProductsLoading}
              hasMore={productPagination.hasMore}
              productTotal={productPagination.total}
              loadMoreRef={loadMoreRef}
            />
          ) : activeView === "orders" ? (
            <OrdersView
              orders={orders}
              onTrack={setSelectedOrder}
              onReorder={(items) => {
                setCart(items);
                setIsCartOpen(true);
              }}
              onCancel={cancelOrder}
              onRate={(order) => setRatingOrder(order)}
              onInvoice={showInvoice}
              onModifyItem={modifyOrderItem}
              onReplacement={updateReplacementPolicy}
            />
          ) : activeView === "wishlist" ? (
            <WishlistView
              products={wishlistProducts}
              addToCart={addToCart}
              updateCart={updateCart}
              cartQuantityByProduct={cartQuantityByProduct}
              openProduct={openProduct}
              toggleWishlist={toggleWishlist}
              wishlistIds={wishlistIds}
              login={() => login("customer")}
              user={user}
            />
          ) : activeView === "admin" && user?.role === "admin" ? (
            <AdminManager summary={adminSummary} products={products} reload={loadProducts} reloadAdmin={loadAdmin} />
          ) : activeView === "account" ? (
            <AccountView
              user={user}
              login={login}
              logout={logout}
              initialAuthMode={authStartMode}
              topUpWallet={topUpWallet}
              openAddress={() => setIsAddressOpen(true)}
              loginWithOtp={loginWithOtp}
              requestEmailOtp={requestEmailOtp}
              verifyEmailOtp={verifyEmailOtp}
              signupWithEmail={signupWithEmail}
              loginSocial={loginSocial}
              notifications={notifications}
              walletHistory={walletHistory}
              updatePreferences={updatePreferences}
              updateProfile={updateProfile}
              changeContactWithOtp={changeContactWithOtp}
              requestEmailChangeOtp={requestEmailChangeOtp}
              verifyEmailChangeOtp={verifyEmailChangeOtp}
              updatePrivacy={updatePrivacy}
              deactivateAccount={deactivateAccount}
              deleteAccount={deleteAccount}
            />
          ) : activeView === "support" ? (
            <SupportView
              orders={orders}
              openOrders={() => setActiveView("orders")}
              raiseIssue={raiseSupportIssue}
            />
          ) : activeView === "features" ? (
            <FeatureMatrixView />
          ) : activeView === "driver" ? (
            <DriverConsoleView
              consoleData={driverConsole}
              proofPin={deliveryProofPin}
              setProofPin={setDeliveryProofPin}
              submitProof={submitDeliveryProof}
              reload={loadDriverConsole}
            />
          ) : (
            <>
              <section className="sectionHeader">
                <h2>
                  {activeView === "handpicked"
                    ? "Handpicked for today"
                    : activeCategory === "All"
                      ? "Quick picks near you"
                      : activeCategory}
                </h2>
                <p>{productPagination.total || visibleProducts.length} products available from your nearest store.</p>
              </section>
              <ProductFilterBar
                categories={categories}
                activeCategory={activeCategory}
                setActiveCategory={(category) => {
                  setActiveCategory(category);
                  if (category !== "All") setActiveView("categories");
                }}
                sortMode={sortMode}
                setSortMode={setSortMode}
                onlyInStock={onlyInStock}
                setOnlyInStock={setOnlyInStock}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                dietaryFilter={dietaryFilter}
                setDietaryFilter={setDietaryFilter}
                minRating={minRating}
                setMinRating={setMinRating}
                discountFilter={discountFilter}
                setDiscountFilter={setDiscountFilter}
                deliveryFilter={deliveryFilter}
                setDeliveryFilter={setDeliveryFilter}
                brandFilters={brandFilters}
                setBrandFilters={setBrandFilters}
                availableBrandFilters={availableBrandFilters}
                resetProductFilters={resetProductFilters}
                resultCount={productPagination.total || visibleProducts.length}
              />
              <ProductGrid
                products={visibleProducts}
                addToCart={addToCart}
                updateCart={updateCart}
                cartQuantityByProduct={cartQuantityByProduct}
                openProduct={openProduct}
                toggleWishlist={toggleWishlist}
                wishlistIds={wishlistIds}
                loading={isProductsLoading}
              />
              <ProductFeedStatus
                markerRef={loadMoreRef}
                loading={isMoreProductsLoading}
                hasMore={productPagination.hasMore}
                shown={visibleProducts.length}
                total={productPagination.total}
              />
              {recommendations?.products?.length > 0 && (
                <RecommendationShelf
                  recommendations={recommendations}
                  addToCart={addToCart}
                  openProduct={openProduct}
                />
              )}
            </>
          )}
        </section>
      </main>

      <nav className="bottomNav">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={activeView === item.key ? "active" : ""}
              onClick={() => setActiveView(item.key)}
            >
              <Icon size={20} />
              {item.label}
            </button>
          );
        })}
        {user?.role === "admin" && (
          <button
            className={activeView === "admin" ? "active" : ""}
            onClick={() => setActiveView("admin")}
          >
            <LayoutDashboard size={20} />
            Admin
          </button>
        )}
      </nav>

      {quote?.summary && cartCount > 0 && (
        <button className="floatingCart" onClick={() => setIsCartOpen(true)}>
          <span>{cartCount} items</span>
          <strong>{currency.format(quote.summary.total)}</strong>
          <small>
            {quote.summary.freeDeliveryShortBy
              ? `Add ${currency.format(quote.summary.freeDeliveryShortBy)} for free delivery`
              : `Free delivery unlocked`}
          </small>
        </button>
      )}

      {isCartOpen && (
        <CartDrawer
          cart={cart}
          quote={quote}
          coupon={coupon}
          setCoupon={setCoupon}
          coupons={availableCoupons}
          updateCart={updateCart}
          close={() => setIsCartOpen(false)}
          checkout={() => setIsCheckoutOpen(true)}
          recommendations={recommendations}
          addToCart={addToCart}
          openProduct={openProduct}
          moveToWishlist={moveCartItemToWishlist}
          saveForLater={saveCartForLater}
          clearCart={clearCart}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutModal
          user={user}
          quote={quote}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          simulatePaymentFailure={simulatePaymentFailure}
          setSimulatePaymentFailure={setSimulatePaymentFailure}
          paymentRecovery={paymentRecovery}
          setPaymentRecovery={setPaymentRecovery}
          coupon={coupon}
          setCoupon={setCoupon}
          coupons={availableCoupons}
          deliverySlot={deliverySlot}
          setDeliverySlot={setDeliverySlot}
          deliveryInstruction={deliveryInstruction}
          setDeliveryInstruction={setDeliveryInstruction}
          replacementChoice={replacementChoice}
          setReplacementChoice={setReplacementChoice}
          openAddress={() => setIsAddressOpen(true)}
          placeOrder={placeOrder}
          close={() => setIsCheckoutOpen(false)}
        />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          quantity={cartQuantityByProduct}
          addToCart={addToCart}
          updateCart={updateCart}
          toggleWishlist={toggleWishlist}
          isSaved={wishlistIds.has(selectedProduct._id)}
          addReview={addReview}
          close={() => setSelectedProduct(null)}
        />
      )}

      {selectedOrder && (
        <TrackingModal
          order={selectedOrder}
          close={() => setSelectedOrder(null)}
          raiseIssue={raiseSupportIssue}
          modifyItem={modifyOrderItem}
          updateReplacementPolicy={updateReplacementPolicy}
        />
      )}

      {isAddressOpen && (
        <AddressModal
          user={user}
          login={login}
          addAddress={addAddress}
          updateAddress={updateAddress}
          deleteAddress={deleteAddress}
          selectedLocation={currentLocation}
          applyLocation={applyLocation}
          close={() => setIsAddressOpen(false)}
          setMessage={setMessage}
        />
      )}
      {isNotificationsOpen && (
        <NotificationsModal
          user={user}
          notifications={notifications}
          close={() => setIsNotificationsOpen(false)}
          markRead={markNotificationsRead}
          login={() => openAuth("emailOtp")}
        />
      )}
      {ratingOrder && (
        <DeliveryRatingModal
          order={ratingOrder}
          close={() => setRatingOrder(null)}
          submit={rateDelivery}
        />
      )}
      {invoiceData && (
        <InvoiceModal
          invoice={invoiceData}
          close={() => setInvoiceData(null)}
        />
      )}
    </div>
  );
}

function ProductGrid({
  products,
  addToCart,
  updateCart,
  cartQuantityByProduct,
  openProduct,
  toggleWishlist,
  wishlistIds = new Set(),
  loading = false,
}) {
  return (
    <div className="productGrid">
      {loading && !products.length && <ProductSkeletonGrid count={8} />}
      {products.map((product) => (
        <article className="productCard" key={product._id}>
          <button className="productImageWrap" onClick={() => openProduct(product)}>
            <ProductImage product={product} />
            <span className="etaBadge">
              <Clock3 size={13} />
              {product.etaMinutes} min
            </span>
          </button>
          {toggleWishlist && (
            <button
              className={wishlistIds.has(product._id) ? "heartButton saved" : "heartButton"}
              onClick={() => toggleWishlist(product)}
              aria-label="Toggle wishlist"
            >
              <Heart size={17} fill={wishlistIds.has(product._id) ? "currentColor" : "none"} />
            </button>
          )}
          <div className="productMeta">
            <div className="productTags">
              {product.isVeg && <span className="vegDot" />}
              {product.discountLabel && <small>{product.discountLabel}</small>}
              {product.isHandpicked && <small>Handpicked</small>}
            </div>
            <button className="productTitleButton" onClick={() => openProduct(product)}>
              <h3>{product.name}</h3>
            </button>
            <p>{product.brand} · {product.packSize}</p>
            <div className="rating">
              <Star size={14} fill="currentColor" />
              {product.rating}
              <span>{product.stock <= 10 ? "Low stock" : "In stock"}</span>
            </div>
            <div className="priceRow">
              <div>
                <strong>{currency.format(product.price)}</strong>
                <del>{currency.format(product.mrp)}</del>
              </div>
              {needsSizeSelection(product) ? (
                <button className="addButton" onClick={() => openProduct(product)}>
                  Choose size
                </button>
              ) : (
                <QuantityButton
                  product={product}
                  quantity={cartQuantityByProduct[product._id] || 0}
                  addToCart={addToCart}
                  updateCart={updateCart}
                />
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductImage({ product, className = "" }) {
  const [failed, setFailed] = useState(false);
  const name = product?.name || "QuickMart product";
  const brand = product?.brand || "QuickMart";
  const category = product?.category || "Fresh";
  const image = product?.image;
  const initials = category
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => setFailed(false), [image]);

  const fallback = (
    <div className={`productImageFallback ${className}`} role="img" aria-label={`${brand} ${name}`}>
      <span>{initials}</span>
      <strong>{name}</strong>
      <small>{brand}</small>
    </div>
  );

  if (!image || failed) return fallback;

  return (
    <div className={`productImageFrame ${className}`}>
      <img
        src={image}
        alt={name}
        onError={() => setFailed(true)}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function ProductSkeletonGrid({ count = 8 }) {
  return Array.from({ length: count }).map((_, index) => (
    <article className="productCard productSkeleton" key={`product-skeleton-${index}`}>
      <span className="skeletonImage" />
      <div className="productMeta">
        <span className="skeletonLine short" />
        <span className="skeletonLine tall" />
        <span className="skeletonLine" />
        <span className="skeletonLine short" />
      </div>
    </article>
  ));
}

function ProductFeedStatus({ markerRef, loading, hasMore, shown, total }) {
  return (
    <div className="feedStatus" ref={markerRef}>
      {loading && (
        <>
          <div className="productGrid feedSkeletonGrid">
            <ProductSkeletonGrid count={4} />
          </div>
          <span>Loading more quick picks...</span>
        </>
      )}
      {!loading && shown > 0 && !hasMore && <span>You have seen all {total || shown} matching items.</span>}
      {!loading && shown > 0 && hasMore && <span>Scroll for more items · {shown} of {total || "many"} loaded</span>}
    </div>
  );
}

function ProductFilterBar({
  categories,
  activeCategory,
  setActiveCategory,
  sortMode,
  setSortMode,
  onlyInStock,
  setOnlyInStock,
  maxPrice,
  setMaxPrice,
  dietaryFilter,
  setDietaryFilter,
  minRating,
  setMinRating,
  discountFilter,
  setDiscountFilter,
  deliveryFilter,
  setDeliveryFilter,
  brandFilters,
  setBrandFilters,
  availableBrandFilters,
  resetProductFilters,
  resultCount,
}) {
  const hasFilters =
    activeCategory !== "All" ||
    sortMode !== "relevance" ||
    onlyInStock ||
    maxPrice !== 500 ||
    dietaryFilter !== "all" ||
    Number(minRating) > 0 ||
    Number(discountFilter) > 0 ||
    Number(deliveryFilter) > 0 ||
    brandFilters.length > 0;
  const toggleBrand = (brand) => {
    setBrandFilters((current) =>
      current.includes(brand)
        ? current.filter((item) => item !== brand)
        : [...current, brand]
    );
  };
  const contextualBrands = [...new Set([...(brandFilters || []), ...(availableBrandFilters || [])])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return (
    <section className="instaFilterPanel">
      <div className="filterHeader">
        <span>
          <SlidersHorizontal size={17} />
          Filters
        </span>
        <small>{resultCount} items</small>
        {hasFilters && (
          <button type="button" onClick={resetProductFilters}>
            Clear all
          </button>
        )}
      </div>

      <div className="filterCategoryScroller">
        <button className={activeCategory === "All" ? "active" : ""} onClick={() => setActiveCategory("All")}>
          All
        </button>
        {(categories || []).map((category) => (
          <button
            key={category.name}
            className={activeCategory === category.name ? "active" : ""}
            onClick={() => setActiveCategory(category.name)}
          >
            <span>{category.icon}</span>
            {category.name}
          </button>
        ))}
      </div>

      {contextualBrands.length > 0 && (
        <div className="brandCheckboxFilter">
          <strong>Brand <span>{contextualBrands.length} available</span></strong>
          <div>
            {contextualBrands.map((brand) => (
              <label className={brandFilters.includes(brand) ? "active" : ""} key={brand}>
                <input
                  type="checkbox"
                  checked={brandFilters.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                />
                {brand}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="instaFilters">
        <label>
          Sort by
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="relevance">Relevance</option>
            <option value="eta">Fastest delivery</option>
            <option value="discount">Best discount</option>
            <option value="price-low">Price low to high</option>
            <option value="price-high">Price high to low</option>
          </select>
        </label>
        <label>
          Price under {currency.format(maxPrice)}
          <input
            type="range"
            min="20"
            max="1000"
            step="10"
            value={maxPrice}
            onChange={(event) => setMaxPrice(Number(event.target.value))}
          />
        </label>
        <label>
          Discount
          <select value={discountFilter} onChange={(event) => setDiscountFilter(Number(event.target.value))}>
            <option value={0}>Any discount</option>
            <option value={10}>10% or more</option>
            <option value={20}>20% or more</option>
            <option value={30}>30% or more</option>
          </select>
        </label>
        <label>
          Delivery
          <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(Number(event.target.value))}>
            <option value={0}>Any ETA</option>
            <option value={10}>Under 10 mins</option>
            <option value={15}>Under 15 mins</option>
          </select>
        </label>
        <label>
          Dietary
          <select value={dietaryFilter} onChange={(event) => setDietaryFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="budget">Budget picks</option>
          </select>
        </label>
        <label>
          Rating
          <select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}>
            <option value={0}>Any rating</option>
            <option value={4}>4+ stars</option>
            <option value={4.5}>4.5+ stars</option>
          </select>
        </label>
        <button
          type="button"
          className={onlyInStock ? "toggleFilter active" : "toggleFilter"}
          onClick={() => setOnlyInStock((value) => !value)}
        >
          <Check size={16} />
          In stock
        </button>
      </div>
    </section>
  );
}

function SearchView({
  products,
  query,
  recentSearches,
  categories,
  activeCategory,
  setActiveCategory,
  sortMode,
  setSortMode,
  onlyInStock,
  setOnlyInStock,
  maxPrice,
  setMaxPrice,
  dietaryFilter,
  setDietaryFilter,
  minRating,
  setMinRating,
  discountFilter,
  setDiscountFilter,
  deliveryFilter,
  setDeliveryFilter,
  brandFilters,
  setBrandFilters,
  availableBrandFilters,
  resetProductFilters,
  runSearch,
  addToCart,
  updateCart,
  cartQuantityByProduct,
  openProduct,
  toggleWishlist,
  wishlistIds,
  loading,
  loadingMore,
  hasMore,
  productTotal,
  loadMoreRef,
}) {
  const popularSearches = ["milk", "banana", "chips", "detergent", "noodles", "body wash", "batteries"];

  return (
    <section className="searchPage">
      <div className="sectionHeader">
        <h2>{query ? `Search results for "${query}"` : "Search quick essentials"}</h2>
        <p>{products.length} matching items from your nearest store.</p>
      </div>

      <div className="searchCommand">
        <div>
          <strong>Recent searches</strong>
          <div className="searchChips">
            {(recentSearches.length ? recentSearches : popularSearches).map((item) => (
              <button key={item} onClick={() => runSearch(item)}>
                <Search size={14} />
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <strong>Popular categories</strong>
          <div className="searchChips">
            <button
              className={activeCategory === "All" ? "selected" : ""}
              onClick={() => setActiveCategory("All")}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.name}
                className={activeCategory === category.name ? "selected" : ""}
                onClick={() => setActiveCategory(category.name)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ProductFilterBar
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        sortMode={sortMode}
        setSortMode={setSortMode}
        onlyInStock={onlyInStock}
        setOnlyInStock={setOnlyInStock}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        dietaryFilter={dietaryFilter}
        setDietaryFilter={setDietaryFilter}
        minRating={minRating}
        setMinRating={setMinRating}
        discountFilter={discountFilter}
        setDiscountFilter={setDiscountFilter}
        deliveryFilter={deliveryFilter}
        setDeliveryFilter={setDeliveryFilter}
        brandFilters={brandFilters}
        setBrandFilters={setBrandFilters}
        availableBrandFilters={availableBrandFilters}
        resetProductFilters={resetProductFilters}
        resultCount={productTotal || products.length}
      />

      {products.length || loading ? (
        <ProductGrid
          products={products}
          addToCart={addToCart}
          updateCart={updateCart}
          cartQuantityByProduct={cartQuantityByProduct}
          openProduct={openProduct}
          toggleWishlist={toggleWishlist}
          wishlistIds={wishlistIds}
          loading={loading}
        />
      ) : (
        <div className="emptyState">
          <Search size={34} />
          <h3>No exact matches</h3>
          <p>Try searching milk, chips, fruits, detergent, drinks or batteries.</p>
          <div className="searchChips">
            {popularSearches.slice(0, 5).map((item) => (
              <button key={item} onClick={() => runSearch(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      <ProductFeedStatus
        markerRef={loadMoreRef}
        loading={loadingMore}
        hasMore={hasMore}
        shown={products.length}
        total={productTotal}
      />
    </section>
  );
}

function RecommendationShelf({ recommendations, addToCart, openProduct }) {
  return (
    <section className="recommendationShelf">
      <div className="sectionHeader">
        <h2>{recommendations.title}</h2>
        <p>{recommendations.reason}</p>
      </div>
      <div className="miniProductRow">
        {recommendations.products.slice(0, 6).map((product) => (
          <article key={product._id}>
            <button onClick={() => openProduct(product)}>
              <ProductImage product={product} />
              <strong>{product.name}</strong>
              <span>{product.brand} · {currency.format(product.price)}</span>
            </button>
            <button
              className="addButton"
              onClick={() => (needsSizeSelection(product) ? openProduct(product) : addToCart(product))}
            >
              {needsSizeSelection(product) ? null : <Plus size={15} />}
              {needsSizeSelection(product) ? "Choose size" : "Add"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DiscoveryShelf({ title, products = [], addToCart, openProduct }) {
  const validProducts = products.filter((item) => item?._id || item?.product);
  if (!validProducts.length) return null;

  return (
    <section className="recommendationShelf">
      <div className="sectionHeader">
        <h2>{title}</h2>
        <p>Personalized discovery, recent behaviour and marketing slots.</p>
      </div>
      <div className="miniProductRow">
        {validProducts.slice(0, 6).map((product) => {
          const normalized = {
            ...product,
            _id: product._id || String(product.product),
            price: product.price || 0,
            mrp: product.mrp || product.price || 0,
            stock: product.stock ?? 10,
            etaMinutes: product.etaMinutes || 10,
          };
          return (
            <article key={`${title}-${normalized._id}`}>
              <button onClick={() => openProduct(normalized)}>
                <ProductImage product={normalized} />
                <strong>{normalized.name}</strong>
                <span>{normalized.brand || "Buy again"} · {currency.format(normalized.price)}</span>
              </button>
              <button
                className="addButton"
                onClick={() => (needsSizeSelection(normalized) ? openProduct(normalized) : addToCart(normalized))}
              >
                {needsSizeSelection(normalized) ? null : <Plus size={15} />}
                {needsSizeSelection(normalized) ? "Choose size" : "Add"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WishlistView({
  products,
  addToCart,
  updateCart,
  cartQuantityByProduct,
  openProduct,
  toggleWishlist,
  wishlistIds,
  login,
  user,
}) {
  if (!user) {
    return (
      <section className="emptyState">
        <Heart size={36} />
        <h2>Login to save favourites</h2>
        <p>Save weekly staples and reorder faster from your wishlist.</p>
        <button className="primaryButton" onClick={login}>Login as customer</button>
      </section>
    );
  }

  return (
    <section className="adminWorkspace">
      <div className="sectionHeader">
        <h2>Wishlist and favourites</h2>
        <p>{products.length} saved items for fast restock.</p>
      </div>
      {products.length ? (
        <ProductGrid
          products={products}
          addToCart={addToCart}
          updateCart={updateCart}
          cartQuantityByProduct={cartQuantityByProduct}
          openProduct={openProduct}
          toggleWishlist={toggleWishlist}
          wishlistIds={wishlistIds}
        />
      ) : (
        <div className="emptyState">
          <Heart size={34} />
          <h3>No favourites yet</h3>
          <p>Tap the heart on any product to save it here.</p>
        </div>
      )}
    </section>
  );
}

function QuantityButton({ product, quantity, addToCart, updateCart, selectedSize = "" }) {
  const lineKey = cartLineKey(product._id, selectedSize);
  const stockLimit = Number(product.stock || 0);
  const atStockLimit = stockLimit > 0 && quantity >= stockLimit;
  if (product.stock <= 0) {
    return (
      <button className="addButton disabled" disabled>
        Out of stock
      </button>
    );
  }

  if (quantity > 0) {
    return (
      <div className="quantityPill">
        <button onClick={() => updateCart(selectedSize ? lineKey : product._id, quantity - 1)}>
          <Minus size={14} />
        </button>
        <strong>{quantity}</strong>
        <button
          disabled={atStockLimit}
          title={atStockLimit ? "No more stock available" : "Add one more"}
          onClick={() => updateCart(selectedSize ? lineKey : product._id, atStockLimit ? quantity : quantity + 1)}
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <button className="addButton" onClick={() => addToCart(product, 1, { selectedSize })}>
      <Plus size={16} />
      Add
    </button>
  );
}

function CartDrawer({
  quote,
  coupon,
  setCoupon,
  coupons,
  updateCart,
  close,
  checkout,
  recommendations,
  addToCart,
  openProduct,
  moveToWishlist,
  saveForLater,
  clearCart,
}) {
  const items = quote?.items || [];
  const summary = quote?.summary;
  const subtotal = summary?.subtotal || 0;
  const couponCards = (coupons || []).map((item) => {
    const minCart = Number(item.minCart ?? item.minimumCart ?? 0);
    const discount = Number(item.discount ?? 0);
    const shortBy = Math.max(minCart - subtotal, 0);
    const isFreeShip = item.code === "FREESHIP";
    const estimatedSavings = shortBy
      ? 0
      : isFreeShip
        ? summary?.deliveryFee || 29
        : Math.min(discount || 0, subtotal);

    return {
      ...item,
      minCart,
      discount,
      shortBy,
      estimatedSavings,
      eligible: shortBy === 0,
      selected: coupon === item.code,
      label: isFreeShip ? "Free delivery" : discount ? `${currency.format(discount)} off` : item.title,
    };
  });
  const bestCoupon = couponCards
    .filter((item) => item.eligible)
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings)[0];

  return (
    <div className="overlay">
      <aside className="drawer">
        <div className="drawerHeader">
          <div>
            <h2>Your cart</h2>
            <p>{items.length} products from QuickMart Fresh</p>
          </div>
          <button className="iconButton" onClick={close}>
            <X />
          </button>
        </div>

        {!!items.length && (
          <div className="cartToolbar">
            <button type="button" onClick={saveForLater}>
              <Heart size={15} />
              Save all for later
            </button>
            <button type="button" className="dangerGhost" onClick={clearCart}>
              <Trash2 size={15} />
              Clear cart
            </button>
          </div>
        )}

        <div className="cartItems">
          {!items.length && (
            <div className="emptyState">
              <ShoppingBag size={34} />
              <h3>Your cart is empty</h3>
              <p>Add daily essentials, fresh produce, snacks and more.</p>
            </div>
          )}
          {items.map((item) => {
            const lineKey = String(item.cartKey || item.product);
            const stockLimit = Number(item.stock || 0);
            const atStockLimit = stockLimit > 0 && item.quantity >= stockLimit;
            return (
              <div className="cartLine" key={lineKey}>
                <ProductImage product={item} />
                <div className="cartLineInfo">
                  <strong>{item.name}</strong>
                  <span>{item.packSize}</span>
                  {item.selectedSize && <small className="cartMeta">Size selected: {item.selectedSize}</small>}
                  <p>{currency.format(item.price)}</p>
                  {atStockLimit && <small className="stockLimitNote">Max stock reached</small>}
                </div>
                <div className="cartLineActions">
                  <div className="stepper">
                    <button onClick={() => updateCart(lineKey, item.quantity - 1)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={atStockLimit}
                      title={atStockLimit ? "No more stock available" : "Add one more"}
                      onClick={() => updateCart(lineKey, atStockLimit ? item.quantity : item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button className="cartWishlistButton" onClick={() => moveToWishlist(item)}>
                    <Heart size={14} />
                    <span>Move to wishlist</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!!items.length && (
          <div className="couponChooser">
            <div className="couponHeader">
              <div>
                <span>Offers for you</span>
                <strong>{summary?.coupon?.applied ? `${summary.coupon.code} applied` : bestCoupon ? `${bestCoupon.code} can save ${currency.format(bestCoupon.estimatedSavings)}` : "Choose a coupon"}</strong>
                <small>{summary?.coupon?.message || "Apply one offer, or continue without a coupon."}</small>
              </div>
              <TicketPercent size={24} />
            </div>

            <button type="button" className={!coupon ? "couponNone selected" : "couponNone"} onClick={() => setCoupon("")}>
              <span>
                <strong>No coupon</strong>
                <small>Continue with product savings only</small>
              </span>
              {!coupon ? <b>Selected</b> : <b>Choose</b>}
            </button>

            {couponCards.map((item) => (
              <button
                type="button"
                key={item.code}
                className={[
                  "couponCard",
                  item.selected ? "selected" : "",
                  item.eligible ? "" : "locked",
                  bestCoupon?.code === item.code ? "best" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setCoupon(item.code)}
              >
                <span className="couponBadge">{item.code}</span>
                <span className="couponCopy">
                  <strong>{item.title}</strong>
                  <small>
                    {item.eligible
                      ? `Save ${currency.format(item.estimatedSavings)} on this cart`
                      : `Add ${currency.format(item.shortBy)} more to unlock`}
                  </small>
                  <em>{item.label}{item.minCart ? ` · Min cart ${currency.format(item.minCart)}` : ""}</em>
                </span>
                <span className="couponAction">
                  {bestCoupon?.code === item.code && <small>Best</small>}
                  <b>{item.selected ? "Applied" : item.eligible ? "Apply" : "Try"}</b>
                </span>
              </button>
            ))}
          </div>
        )}

        {summary && (
          <div className="billBox">
            <BillLine label="Coupon" value={summary.coupon?.applied ? summary.coupon.code : coupon ? "Not eligible yet" : "No coupon"} />
            <BillLine label="Item total" value={currency.format(summary.subtotal)} />
            <BillLine label="Product savings" value={`-${currency.format(summary.productDiscount ?? summary.discount)}`} />
            <BillLine label="Coupon savings" value={`-${currency.format(summary.couponDiscount || 0)}`} />
            <BillLine label="Delivery" value={summary.deliveryFee ? currency.format(summary.deliveryFee) : "Free"} />
            <BillLine label="GST" value={currency.format(summary.tax || 0)} />
            <BillLine label="Handling" value={currency.format(summary.handlingFee)} />
            <BillLine label="To pay" value={currency.format(summary.total)} strong />
          </div>
        )}

        {items.some((item) => item.stock <= item.quantity) && (
          <div className="edgeAlert">
            Limited stock detected. Replacement or auto-removal will be suggested at checkout.
          </div>
        )}

        <button className="primaryButton" disabled={!items.length} onClick={checkout}>
          <Truck size={18} />
          Checkout
        </button>
        {recommendations?.products?.length > 0 && (
          <div className="drawerRecommendations">
            <strong>{recommendations.title}</strong>
            <span>Coupons are optional. Apply one above if you want the discount.</span>
            <small>{recommendations.reason}</small>
            {recommendations.products.slice(0, 3).map((product) => (
              <button
                key={product._id}
                onClick={() => (needsSizeSelection(product) && openProduct ? openProduct(product) : addToCart(product))}
              >
                <ProductImage product={product} />
                <span>{product.name}</span>
                <b>{needsSizeSelection(product) ? "Choose size" : currency.format(product.price)}</b>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function BillLine({ label, value, strong }) {
  return (
    <div className={strong ? "billLine strong" : "billLine"}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CheckoutModal({
  user,
  quote,
  paymentMode,
  setPaymentMode,
  simulatePaymentFailure,
  setSimulatePaymentFailure,
  paymentRecovery,
  setPaymentRecovery,
  coupon,
  setCoupon,
  coupons,
  deliverySlot,
  setDeliverySlot,
  deliveryInstruction,
  setDeliveryInstruction,
  replacementChoice,
  setReplacementChoice,
  openAddress,
  placeOrder,
  close,
}) {
  const address = user?.addresses?.[0];

  return (
    <div className="overlay">
      <section className="checkoutModal">
        <div className="drawerHeader">
          <div>
            <h2>Checkout</h2>
            <p>Delivery partner will arrive in 8-12 minutes.</p>
          </div>
          <button className="iconButton" onClick={close}>
            <X />
          </button>
        </div>

        <div className="checkoutGrid">
          <div className="checkoutCard">
            <Home size={20} />
            <div>
              <strong>{address?.label || "Home"}</strong>
              <p>{address ? `${address.line1}, ${address.area}` : "Login will add your demo address."}</p>
            </div>
            <button className="linkButton" onClick={openAddress}>Change</button>
          </div>
          <div className="checkoutCard">
            <Clock3 size={20} />
            <div>
              <strong>Delivery slot</strong>
              <select value={deliverySlot} onChange={(event) => setDeliverySlot(event.target.value)}>
                {deliverySlots.map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="checkoutOptions">
          <label>
            Coupon
            <select value={coupon} onChange={(event) => setCoupon(event.target.value)}>
              <option value="">No coupon</option>
              {coupons.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.title}</option>
              ))}
            </select>
          </label>
          <label>
            Delivery instructions
            <input value={deliveryInstruction} onChange={(event) => setDeliveryInstruction(event.target.value)} />
          </label>
          <label>
            Replacement preference
            <select value={replacementChoice} onChange={(event) => setReplacementChoice(event.target.value)}>
              <option>Call before replacing unavailable items</option>
              <option>Replace with closest match automatically</option>
              <option>Remove unavailable items and refund</option>
            </select>
          </label>
        </div>

        <div className="paymentModes">
          {["upi", "card", "wallet", "cod"].map((mode) => (
            <button
              className={paymentMode === mode ? "selected" : ""}
              key={mode}
              onClick={() => {
                setPaymentMode(mode);
                setPaymentRecovery(null);
              }}
            >
              <WalletCards size={17} />
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="recoveryPanel">
          <label>
            <input
              type="checkbox"
              checked={simulatePaymentFailure}
              onChange={(event) => setSimulatePaymentFailure(event.target.checked)}
            />
            Simulate UPI/card payment failure recovery
          </label>
          {paymentRecovery && (
            <div className="recoveryAlert">
              <strong>{paymentRecovery.title}</strong>
              <span>{paymentRecovery.body}</span>
              <button type="button" onClick={() => { setPaymentMode("cod"); setPaymentRecovery(null); }}>
                Switch to COD
              </button>
              <button type="button" onClick={() => setPaymentRecovery(null)}>Retry payment</button>
            </div>
          )}
        </div>

        <div className="billBox">
          <BillLine label="Item total" value={currency.format(quote?.summary?.subtotal || 0)} />
          <BillLine label="Product savings" value={`-${currency.format(quote?.summary?.productDiscount || 0)}`} />
          <BillLine label="Coupon savings" value={`-${currency.format(quote?.summary?.couponDiscount || 0)}`} />
          <BillLine label="Delivery" value={quote?.summary?.deliveryFee ? currency.format(quote.summary.deliveryFee) : "Free"} />
          <BillLine label="Total" value={currency.format(quote?.summary?.total || 0)} strong />
        </div>

        <button className="primaryButton" onClick={placeOrder}>
          <PackageCheck size={18} />
          Place order
        </button>
      </section>
    </div>
  );
}

function ProductModal({ product, quantity, addToCart, updateCart, toggleWishlist, isSaved, addReview, close }) {
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [selectedSize, setSelectedSize] = useState(
    needsSizeSelection(product)
      ? clothingSizes.find((size) => String(product.packSize || "").toUpperCase().includes(size)) || "M"
      : ""
  );
  const nutrition = product.nutrition || {};
  const sizeRequired = needsSizeSelection(product);
  const selectedLineKey = cartLineKey(product._id, selectedSize);
  const modalQuantity = sizeRequired ? quantity[selectedLineKey] || 0 : quantity[product._id] || 0;
  const modalProduct = {
    ...product,
    packSize: selectedSize ? `${selectedSize} size` : product.packSize,
  };

  return (
    <div className="overlay">
      <section className="productModal">
        <button className="modalClose iconButton" onClick={close}>
          <X />
        </button>
        <ProductImage product={product} />
        <div className="productModalBody">
          <div className="productTags">
            <small>{product.category}</small>
            <small>{product.stock <= 10 ? "Few left" : `${product.stock} in stock`}</small>
            <small>{product.etaMinutes} min delivery</small>
            {product.replacementAvailable && <small>Replacement eligible</small>}
          </div>
          <h2>{product.name}</h2>
          <div className="modalCartBar">
            <div>
              <small>{product.stock > 0 ? `${product.stock} available` : "Currently out of stock"}</small>
              <strong>{currency.format(product.price)}</strong>
              <del>{currency.format(product.mrp)}</del>
            </div>
            <QuantityButton
              product={modalProduct}
              quantity={modalQuantity}
              addToCart={addToCart}
              updateCart={updateCart}
              selectedSize={selectedSize}
            />
          </div>
          <p>{product.brand} · {modalProduct.packSize}</p>
          <p>{product.description || "Freshly packed from the nearest quick-commerce store."}</p>
          {sizeRequired && (
            <div className="sizeSelector">
              <div>
                <strong>Select size</strong>
                <small>Choose one size before adding clothing to cart.</small>
              </div>
              <div className="sizeOptions">
                {clothingSizes.map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={selectedSize === size ? "active" : ""}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <small className="sizeHint">Selected: {selectedSize} · You can add another size separately.</small>
            </div>
          )}
          <button className={isSaved ? "saveWide saved" : "saveWide"} onClick={() => toggleWishlist(product)}>
            <Heart size={17} fill={isSaved ? "currentColor" : "none"} />
            {isSaved ? "Saved to wishlist" : "Save to wishlist"}
          </button>
          <div className="variantGrid">
            {(product.variants || []).map((variant) => (
              <button key={variant.label}>
                <strong>{variant.label}</strong>
                <span>{variant.packSize} · {currency.format(variant.price)}</span>
              </button>
            ))}
          </div>
          <div className="detailList">
            {(product.highlights || ["Quality checked", "Packed nearby", "Save to quick picks"]).map((item) => (
              <span key={item}><ShieldCheck size={17} /> {item}</span>
            ))}
            <span><Truck size={17} /> Origin: {product.origin || "Nearby store"}</span>
            <span><Heart size={17} /> Shelf life: {product.shelfLife || "See pack"}</span>
          </div>
          <div className="nutritionGrid">
            <strong>Nutrition and ingredients</strong>
            <span>Calories: {nutrition.calories || "See pack"}</span>
            <span>Protein: {nutrition.protein || "See pack"}</span>
            <span>Carbs: {nutrition.carbs || "See pack"}</span>
            <span>Fat: {nutrition.fat || "See pack"}</span>
            <p>{nutrition.ingredients || "Ingredients vary by batch. Check pack before use."}</p>
            <small>{nutrition.allergenInfo || "Allergen info shown on pack."}</small>
          </div>
          <div className="substituteBox">
            <strong>If unavailable, use a substitute</strong>
            {(product.substitutes || []).map((item) => (
              <span key={item.name}>{item.name} · {item.packSize} · {currency.format(item.price)}</span>
            ))}
          </div>
          <div className="priceRow">
            <div>
              <strong>{currency.format(product.price)}</strong>
              <del>{currency.format(product.mrp)}</del>
            </div>
            <QuantityButton
              product={modalProduct}
              quantity={modalQuantity}
              addToCart={addToCart}
              updateCart={updateCart}
              selectedSize={selectedSize}
            />
          </div>
          <div className="reviewsBox">
            <strong>Ratings and reviews</strong>
            <span>{product.rating} stars from {product.reviewCount || product.reviews?.length || 0} reviews</span>
            {(product.reviews || []).slice(-2).map((review) => (
              <p key={`${review.userName}-${review.comment}`}>
                <Star size={13} fill="currentColor" /> {review.userName}: {review.comment}
              </p>
            ))}
            <div className="reviewForm">
              <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option value={rating} key={rating}>{rating} stars</option>
                ))}
              </select>
              <input
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="Write a quick review"
              />
              <button
                onClick={() => {
                  addReview(product, { rating: reviewRating, comment: reviewText || "Fresh and fast." });
                  setReviewText("");
                }}
              >
                Add review
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrackingModal({ order, close, raiseIssue, modifyItem, updateReplacementPolicy }) {
  return (
    <div className="overlay">
      <section className="trackingModal">
        <div className="drawerHeader">
          <div>
            <h2>Tracking #{shortOrderId(order)}</h2>
            <p>{order.deliverySlot || "Arriving soon"}</p>
          </div>
          <button className="iconButton" onClick={close}><X /></button>
        </div>
        <div className="mapMock">
          <Navigation size={38} />
          <span>{order.rider?.name || "Delivery partner"} is 1.2 km away</span>
          <small>Live map demo: {order.rider?.lat || 12.9352}, {order.rider?.lng || 77.6245}</small>
          <strong>Delivery PIN: {order.deliveryPin || "4286"}</strong>
        </div>
        {order.partialFulfillment?.hasChanges && (
          <div className="fulfillmentBox">
            <strong>Partial fulfillment alert</strong>
            <span>{(order.partialFulfillment.unavailableItems || []).join(", ")}</span>
            <small>{order.partialFulfillment.replacementPolicy}</small>
          </div>
        )}
        {canChangeOrder(order) && (
          <div className="fulfillmentBox">
            <strong>Modify before delivery</strong>
            {safeOrderItems(order).map((item) => (
              <div className="modifyLine" key={String(item.product)}>
                <span>{item.name}</span>
                <button onClick={() => modifyItem(order, item, Math.max(item.quantity - 1, 0))}>-</button>
                <b>{item.quantity}</b>
                <button onClick={() => modifyItem(order, item, item.quantity + 1)}>+</button>
              </div>
            ))}
            <button onClick={() => updateReplacementPolicy(order, "Customer approved closest replacement")}>
              Approve closest replacement
            </button>
          </div>
        )}
        <div className="verticalTimeline">
          {safeOrderTimeline(order).map((step) => (
            <div className={step.done ? "trackStep done" : "trackStep"} key={step.label}>
              <Check size={16} />
              <div>
                <strong>{step.label}</strong>
                <p>{step.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="supportRow">
          <button onClick={() => raiseIssue(order, "Need chat support")}>
            <MessageCircle size={17} /> Chat support
          </button>
          <button onClick={() => raiseIssue(order, "Call delivery partner requested")}>
            <Headphones size={17} /> Call partner
          </button>
        </div>
      </section>
    </div>
  );
}

function OutOfServiceView({ location, zones, chooseLocation, chooseZone }) {
  const availableZones = zones.filter((zone) => zone.available);

  return (
    <section className="outOfServicePage">
      <div className="outOfServiceIcon">
        <MapPin size={34} />
      </div>
      <p className="eyebrow">Outside service area</p>
      <h1>We are not delivering here yet</h1>
      <p>
        {location?.area
          ? `${location.area} is currently outside our QuickMart Fresh delivery coverage.`
          : "This location is currently outside our QuickMart Fresh delivery coverage."}
      </p>
      <div className="outOfServiceActions">
        <button className="primaryButton" onClick={chooseLocation}>
          <LocateFixed size={18} />
          Change location
        </button>
      </div>
      <div className="serviceZoneList">
        <strong>Available delivery zones</strong>
        <div>
          {availableZones.map((zone) => (
            <button key={`${zone.area}-${zone.city}`} onClick={() => chooseZone(zone)}>
              <span>{zone.area}</span>
              <small>{zone.city} - {zone.eta} min</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AddressModal({ user, login, addAddress, updateAddress, deleteAddress, selectedLocation, applyLocation, close, setMessage }) {
  const address = user?.addresses?.[0];
  const [serviceability, setServiceability] = useState(null);
  const [zones, setZones] = useState([]);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [form, setForm] = useState({
    label: "Office",
    line1: "Building / flat number",
    area: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    instructions: "Call on arrival",
  });

  useEffect(() => {
    api("/api/serviceability/zones")
      .then((data) => setZones(data.zones || []))
      .catch(() => setZones([]));
  }, []);

  const fillFormFromZone = (zone, source = "manual") => {
    const preset = addressPresets[zone.area] || {
      label: "Home",
      line1: `Delivery address near ${zone.area}`,
      pincode: "",
      instructions: "Call on arrival",
    };
    setForm((value) => ({
      ...value,
      label: source === "gps" ? "Current GPS" : preset.label,
      line1: source === "gps" && value.line1?.startsWith("GPS") ? value.line1 : preset.line1,
      area: zone.area,
      city: zone.city,
      pincode: preset.pincode,
      instructions: preset.instructions,
    }));
  };

  useEffect(() => {
    if (!zones.length || !selectedLocation?.area || editingAddressId) return;
    const selectedZone = zones.find((zone) => selectedLocation.area.includes(zone.area));
    if (selectedZone) fillFormFromZone(selectedZone);
  }, [editingAddressId, selectedLocation?.area, zones]);

  const applyZone = (zone, source = "manual") => {
    const nextServiceability = {
      zone,
      message: zone.available
        ? `Delivery available in ${zone.area} within ${zone.eta} minutes`
        : "Sorry, this area is outside the current demo service zone",
    };
    setServiceability(nextServiceability);
    applyLocation({
      ...zone,
      label: source === "gps" ? "Delivering to Current GPS" : `Delivering to ${zone.area}`,
      eta: zone.available ? `${zone.eta} mins` : "Unavailable",
    });
    fillFormFromZone(zone, source);
    if (!zone.available) close();
    if (zone.available) setMessage(nextServiceability.message);
  };

  const fillAddressFromSelectedLocation = () => {
    const selectedZone = zones.find((zone) => selectedLocation?.area?.includes(zone.area)) || zones.find((zone) => zone.available);
    if (!selectedZone) {
      setMessage("Select a delivery zone first");
      return;
    }
    applyZone(selectedZone);
    setMessage(`Address form filled for ${selectedZone.area}`);
  };

  const findNearestZone = ({ latitude, longitude }, sourceZones = zones) => {
    const zonesWithCoords = sourceZones.filter((zone) => Number.isFinite(zone.latitude) && Number.isFinite(zone.longitude));
    if (!zonesWithCoords.length) return sourceZones.find((zone) => zone.available);
    return zonesWithCoords
      .map((zone) => ({
        ...zone,
        distanceKm: distanceBetweenCoords({ latitude, longitude }, zone),
      }))
      .sort((first, second) => first.distanceKm - second.distanceKm)[0];
  };

  const checkServiceability = async () => {
    const data = await api(`/api/serviceability?area=${encodeURIComponent(form.area)}`);
    setServiceability(data);
    applyLocation({
      ...data.zone,
      label: `Delivering to ${data.zone.area}`,
      eta: data.zone.available ? `${data.zone.eta} mins` : "Unavailable",
    });
    if (!data.zone.available) close();
    if (data.zone.available) setMessage(data.message);
  };

  const saveAddress = async () => {
    if (editingAddressId) {
      await updateAddress(editingAddressId, form);
      setEditingAddressId("");
      return;
    }
    await addAddress(form);
  };

  const startAddressEdit = (savedAddress) => {
    setEditingAddressId(savedAddress._id);
    setForm({
      label: savedAddress.label || "",
      line1: savedAddress.line1 || "",
      area: savedAddress.area || "",
      city: savedAddress.city || "",
      pincode: savedAddress.pincode || "",
      instructions: savedAddress.instructions || "",
    });
    setServiceability(null);
  };

  const useSavedAddress = async (savedAddress) => {
    const data = await api(`/api/serviceability?area=${encodeURIComponent(savedAddress.area || "")}`);
    setServiceability(data);
    applyLocation({
      ...data.zone,
      label: `Delivering to ${savedAddress.label || data.zone.area}`,
      area: `${savedAddress.area || data.zone.area}, ${savedAddress.city || data.zone.city}`,
      eta: data.zone.available ? `${data.zone.eta} mins` : "Unavailable",
    });
    setMessage(data.message);
  };

  const useBrowserGps = () => {
    if (!navigator.geolocation) {
      setMessage("GPS is not available in this browser");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geo = await api(`/api/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`).catch(() => ({
          displayName: `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          city: "Detected by GPS",
          pincode: "",
          road: "",
        }));
        let gpsZones = zones;
        if (!gpsZones.length) {
          const data = await api("/api/serviceability/zones");
          gpsZones = data.zones || [];
          setZones(gpsZones);
        }
        const nearestZone = findNearestZone({ latitude, longitude }, gpsZones) || {
          area: "Current Location",
          city: geo.city || "Detected by GPS",
          eta: 15,
          available: true,
        };
        const gpsLine = `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        const gpsDisplay = geo.displayName || gpsLine;
        const gpsZone = nearestZone.distanceKm > 25
          ? {
              area: gpsDisplay,
              displayArea: gpsDisplay,
              city: geo.city || "Outside coverage",
              eta: 0,
              available: false,
              latitude,
              longitude,
            }
          : nearestZone;
        const preset = addressPresets[gpsZone.area] || {
          label: "Current GPS",
          line1: geo.road ? `${geo.road}, ${geo.city || "Detected location"}` : `Detected near ${gpsDisplay}`,
          pincode: geo.pincode || "",
          instructions: "Use GPS pin for delivery",
        };
        setForm((value) => ({
          ...value,
          label: "Current GPS",
          line1: `${preset.line1} (${gpsLine})`,
          area: gpsZone.area,
          city: gpsZone.city,
          pincode: preset.pincode,
          instructions: `${preset.instructions}. Detected coordinates ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        }));
        const data = gpsZone.available
          ? await api(`/api/serviceability?area=${encodeURIComponent(gpsZone.area)}`)
          : {
              zone: gpsZone,
              message: "Your current GPS location is outside our serviceable area",
            };
        setServiceability(data);
        applyLocation({
          ...data.zone,
          label: "Delivering to Current GPS",
          area: data.zone.area,
          displayArea: data.zone.displayArea || (data.zone.available ? `${data.zone.area}, ${data.zone.city}` : gpsDisplay),
          eta: data.zone.available ? `${data.zone.eta} mins` : "Unavailable",
        });
        if (!data.zone.available) close();
        if (data.zone.available) setMessage(`GPS detected near ${data.zone.area}. ${data.message}`);
        setGpsBusy(false);
      },
      (error) => {
        const blockedLocation = {
          area: "Device location not available",
          displayArea: "Device location not available",
          city: "GPS permission blocked",
          eta: 0,
          available: false,
        };
        setForm((value) => ({
          ...value,
          label: "Current GPS",
          line1: error?.message || "Browser could not share this device location",
          area: blockedLocation.area,
          city: blockedLocation.city,
        }));
        applyLocation({
          ...blockedLocation,
          label: "Current GPS unavailable",
          eta: "Unavailable",
        });
        close();
        setMessage("");
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  return (
    <div className="overlay">
      <section className="checkoutModal">
        <div className="drawerHeader">
          <div>
            <h2>Delivery address</h2>
            <p>Choose GPS, a service zone, or a saved address for quick checkout.</p>
          </div>
          <button className="iconButton" onClick={close}><X /></button>
        </div>
        <div className="currentLocationCard">
          <MapPin size={18} />
          <span>
            <strong>{selectedLocation?.area || "No delivery location selected"}</strong>
            <small>{selectedLocation?.eta ? `ETA: ${selectedLocation.eta}` : "Pick a location to update the whole app."}</small>
          </span>
        </div>
        <div className="zonePicker">
          <strong>Quick select delivery zone</strong>
          <div>
            {zones.map((zone) => (
              <button
                key={`${zone.area}-${zone.city}`}
                className={selectedLocation?.area?.includes(zone.area) ? "zoneButton selected" : "zoneButton"}
                type="button"
                onClick={() => applyZone(zone)}
              >
                <span>{zone.area}</span>
                <small>{zone.available ? `${zone.city} - ${zone.eta} min` : "Unavailable"}</small>
              </button>
            ))}
          </div>
          <button className="secondaryButton addressAssistButton" type="button" onClick={fillAddressFromSelectedLocation}>
            <Plus size={16} />
            Fill address form from selected location
          </button>
        </div>
        {!user ? (
          <button className="primaryButton" onClick={() => login("customer")}>
            <UserRound size={18} />
            Login to use saved address
          </button>
        ) : (
          <div className="addressList">
            {(user.addresses || []).map((savedAddress, index) => (
              <div className={index === 0 ? "addressCard selected" : "addressCard"} key={savedAddress._id || savedAddress.label}>
                <MapPin size={20} />
                <span>
                  <strong>{savedAddress.label || "Home"}</strong>
                  <small>{`${savedAddress.line1}, ${savedAddress.area}, ${savedAddress.city}`}</small>
                </span>
                <div className="addressActions">
                  {index === 0 ? <Check size={18} /> : <ChevronRight size={18} />}
                  <button type="button" onClick={() => useSavedAddress(savedAddress)}>Use</button>
                  <button type="button" onClick={() => startAddressEdit(savedAddress)}>Edit</button>
                  <button type="button" className="dangerButton" onClick={() => deleteAddress(savedAddress._id)}>Delete</button>
                </div>
              </div>
            ))}
            <div className="addressForm">
              <strong>{editingAddressId ? "Edit address" : "Add new address"}</strong>
              {["label", "line1", "area", "city", "pincode", "instructions"].map((field) => (
                <input
                  key={field}
                  value={form[field]}
                  placeholder={field}
                  onChange={(event) => setForm((value) => ({ ...value, [field]: event.target.value }))}
                />
              ))}
              <button className="primaryButton" onClick={saveAddress}>
                <Plus size={18} />
                {editingAddressId ? "Update address" : "Save address"}
              </button>
              {editingAddressId && (
                <button className="secondaryButton" onClick={() => {
                  setEditingAddressId("");
                  setForm({ label: "Office", line1: "Building / flat number", area: "Indiranagar", city: "Bengaluru", pincode: "560038", instructions: "Call on arrival" });
                }}>
                  Cancel edit
                </button>
              )}
              <button
                className="linkButton"
                onClick={useBrowserGps}
              >
                <LocateFixed size={16} />
                {gpsBusy ? "Detecting GPS..." : "Use current location"}
              </button>
              <button className="linkButton" onClick={checkServiceability}>
                <MapPin size={16} />
                Check serviceability
              </button>
              {serviceability && (
                <small>
                  {serviceability.zone.available ? "Available" : "Unavailable"} · {serviceability.zone.area} · {serviceability.zone.eta || "No"} min
                </small>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function NotificationsModal({ user, notifications, close, markRead, login }) {
  return (
    <div className="overlay">
      <section className="checkoutModal notificationModal">
        <div className="drawerHeader">
          <div>
            <h2>Notifications</h2>
            <p>Order updates, offers, refunds and re-engagement alerts.</p>
          </div>
          <button className="iconButton" onClick={close}><X /></button>
        </div>
        {!user ? (
          <button className="primaryButton" onClick={login}>
            <UserRound size={18} />
            Login to view notifications
          </button>
        ) : (
          <>
            <div className="notificationList">
              {(notifications || []).map((item, index) => (
                <article className={item.read ? "notificationCard" : "notificationCard unread"} key={`${item.title}-${index}`}>
                  <Bell size={18} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <small>{item.read ? "Read" : "Unread"}</small>
                  </div>
                </article>
              ))}
              {!(notifications || []).length && (
                <p className="emptyInline">No notifications yet. Place an order to see live updates here.</p>
              )}
            </div>
            <button className="primaryButton" onClick={markRead}>Mark all read</button>
          </>
        )}
      </section>
    </div>
  );
}

function DeliveryRatingModal({ order, close, submit }) {
  const [rating, setRating] = useState(order.deliveryRating || 5);
  const [tags, setTags] = useState(order.deliveryFeedback?.tags || []);
  const [comment, setComment] = useState(order.deliveryFeedback?.comment || "");
  const tagOptions = ["Fast delivery", "Polite partner", "Good packing", "Found location", "Late", "Missing item"];
  const toggleTag = (tag) => {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  return (
    <div className="overlay">
      <section className="checkoutModal ratingModal">
        <div className="drawerHeader">
          <div>
            <h2>Rate delivery</h2>
            <p>Order #{shortOrderId(order)} · Help improve delivery quality.</p>
          </div>
          <button className="iconButton" onClick={close}><X /></button>
        </div>
        <div className="starPicker">
          {[1, 2, 3, 4, 5].map((value) => (
            <button className={value <= rating ? "active" : ""} key={value} onClick={() => setRating(value)}>
              <Star size={26} fill="currentColor" />
            </button>
          ))}
        </div>
        <div className="feedbackTags">
          {tagOptions.map((tag) => (
            <button className={tags.includes(tag) ? "selected" : ""} key={tag} onClick={() => toggleTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <textarea
          className="feedbackText"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Optional feedback for the delivery experience"
        />
        <button className="primaryButton" onClick={() => submit(order, { rating, tags, comment })}>
          Submit rating
        </button>
      </section>
    </div>
  );
}

function InvoiceModal({ invoice, close }) {
  const copySummary = async () => {
    const text = `Invoice ${invoice.number}\nTotal: ${currency.format(invoice.total)}\nGSTIN: ${invoice.gstin}`;
    await navigator.clipboard?.writeText(text);
  };
  const invoiceHtml = () => {
    const rows = (invoice.items || [])
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${item.packSize || ""}</td>
            <td>${item.quantity || 1}</td>
            <td>${currency.format(item.price || 0)}</td>
            <td>${currency.format((item.price || 0) * (item.quantity || 1))}</td>
          </tr>`
      )
      .join("");
    return `
      <!doctype html>
      <html>
        <head>
          <title>Invoice ${invoice.number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #17202a; }
            h1 { margin: 0 0 6px; }
            .muted { color: #64748b; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 22px 0; }
            .box { padding: 12px; border: 1px solid #d9e2ec; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 18px 0; }
            th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            th { background: #f8fafc; }
            .totals { width: 320px; margin-left: auto; }
            .totals div { display: flex; justify-content: space-between; padding: 7px 0; }
            .strong { font-weight: 800; border-top: 2px solid #111827; margin-top: 6px; }
            @media print { button { display: none; } body { margin: 18px; } }
          </style>
        </head>
        <body>
          <button onclick="window.focus(); window.print()">Print</button>
          <h1>Tax Invoice</h1>
          <p class="muted">${invoice.number} · GSTIN ${invoice.gstin}</p>
          <div class="grid">
            <div class="box"><strong>Billed to</strong><br>${invoice.billedTo?.line1 || "Customer"}, ${invoice.billedTo?.area || ""}</div>
            <div class="box"><strong>Payment</strong><br>${String(invoice.paymentMode || "").toUpperCase()} · ${invoice.paymentStatus || ""}</div>
            <div class="box"><strong>Issued</strong><br>${invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : "Today"}</div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Pack</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal</span><strong>${currency.format(invoice.subtotal || 0)}</strong></div>
            <div><span>Discount</span><strong>-${currency.format(invoice.discount || 0)}</strong></div>
            <div><span>Delivery fee</span><strong>${currency.format(invoice.deliveryFee || 0)}</strong></div>
            <div><span>Handling fee</span><strong>${currency.format(invoice.handlingFee || 0)}</strong></div>
            <div><span>GST</span><strong>${currency.format(invoice.tax || 0)}</strong></div>
            <div class="strong"><span>Total</span><strong>${currency.format(invoice.total || 0)}</strong></div>
          </div>
        </body>
      </html>
    `;
  };
  const printInvoice = () => {
    const frame = document.createElement("iframe");
    frame.title = `Invoice ${invoice.number}`;
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const printDocument = frame.contentWindow?.document;
    if (!printDocument) return;
    printDocument.open();
    printDocument.write(invoiceHtml());
    printDocument.close();

    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1000);
    };
  };
  const downloadInvoice = () => {
    const blob = new Blob([invoiceHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.number || "invoice"}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overlay">
      <section className="checkoutModal invoiceModal">
        <div className="drawerHeader">
          <div>
            <h2>Tax invoice</h2>
            <p>{invoice.number} · GSTIN {invoice.gstin}</p>
          </div>
          <button className="iconButton" onClick={close}><X /></button>
        </div>
        <div className="invoiceMeta">
          <div><strong>Billed to</strong><span>{invoice.billedTo?.line1 || "Customer"}, {invoice.billedTo?.area || "Bengaluru"}</span></div>
          <div><strong>Payment</strong><span>{invoice.paymentMode?.toUpperCase()} · {invoice.paymentStatus}</span></div>
          <div><strong>Issued</strong><span>{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : "Today"}</span></div>
        </div>
        <div className="invoiceTable">
          {(invoice.items || []).map((item) => (
            <div key={`${item.name}-${item.quantity}`}>
              <span>{item.quantity}x {item.name}</span>
              <small>{item.packSize}</small>
              <strong>{currency.format((item.price || 0) * (item.quantity || 1))}</strong>
            </div>
          ))}
        </div>
        <div className="billBox">
          <BillLine label="Subtotal" value={currency.format(invoice.subtotal || 0)} />
          <BillLine label="Discount" value={`-${currency.format(invoice.discount || 0)}`} />
          <BillLine label="Delivery fee" value={currency.format(invoice.deliveryFee || 0)} />
          <BillLine label="Handling fee" value={currency.format(invoice.handlingFee || 0)} />
          <BillLine label="GST" value={currency.format(invoice.tax || 0)} />
          <BillLine label="Total" value={currency.format(invoice.total || 0)} strong />
        </div>
        <div className="invoiceActions">
          <button onClick={copySummary}>Copy summary</button>
          <button onClick={printInvoice}>Print invoice</button>
          <button onClick={downloadInvoice}>Download invoice</button>
        </div>
      </section>
    </div>
  );
}

const featureMatrix = [
  { area: "Auth", status: "Live", detail: "Email signup, real email OTP, demo mobile OTP, Google/Apple demo login, admin login." },
  { area: "Location", status: "Improved", detail: "GPS demo, manual address CRUD, serviceability checks, saved locations." },
  { area: "Discovery", status: "Live", detail: "Banners, category grid, trending, buy-again, personalized shelves, sponsored products." },
  { area: "Search", status: "Live", detail: "Autocomplete, filters, sort, recent searches, typo/synonym backend matching." },
  { area: "Products", status: "Live", detail: "PLP/PDP, variants, nutrition, substitutes, reviews, stock and ETA." },
  { area: "Cart", status: "Live", detail: "Quantity update, smart quote, coupon, recommendations, low-stock quantity caps." },
  { area: "Checkout", status: "Improved", detail: "Address, slots, UPI/card/wallet/COD demo, payment failure recovery, replacement preference." },
  { area: "Orders", status: "Live", detail: "Place order, tracking timeline, map demo, cancel window, invoice, reorder." },
  { area: "Support", status: "Live", detail: "Missing item/refund/payment issue flows and order support notes." },
  { area: "Admin", status: "Live", detail: "Split dashboards, user CRUD, product/category CRUD, marketing CRUD, partner/staff CRUD." },
  { area: "Native-only", status: "Simulated", detail: "Push notifications, OTP auto-read, live rider GPS, device binding, voice search are represented as web demos." },
  { area: "Scale systems", status: "Partial", detail: "AI pricing, fraud engine, real payment rails, warehouse OMS, live maps need production services." },
];

function FeatureMatrixView() {
  const complete = featureMatrix.filter((item) => item.status === "Live").length;
  return (
    <section>
      <div className="sectionHeader">
        <h2>Feature coverage map</h2>
        <p>{complete} live modules, plus improved/simulated modules for a fuller quick-commerce clone.</p>
      </div>
      <div className="featureMatrix">
        {featureMatrix.map((item) => (
          <article className={`featureTile ${item.status.toLowerCase().replace(/[^a-z]+/g, "-")}`} key={item.area}>
            <span>{item.status}</span>
            <h3>{item.area}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DriverConsoleView({ consoleData, proofPin, setProofPin, submitProof, reload }) {
  return (
    <section>
      <div className="sectionHeader">
        <h2>Delivery partner console</h2>
        <p>Assigned trips, COD collection, GPS handoff and delivery PIN proof workflow.</p>
      </div>
      <div className="driverStats">
        <Stat icon={Truck} label="Partner" value={consoleData?.partner?.name || "Aman Verma"} />
        <Stat icon={ReceiptText} label="Assigned" value={consoleData?.orders?.length || 0} />
        <Stat icon={WalletCards} label="COD collection" value={currency.format(consoleData?.codCollection || 0)} />
      </div>
      <button className="linkButton" onClick={reload}>Refresh assignments</button>
      <div className="ordersList">
        {(consoleData?.orders || []).map((order) => (
          <article className="orderCard" key={order._id}>
            <div className="orderTop">
              <span>#{shortOrderId(order)}</span>
              <strong>{order.status}</strong>
            </div>
            <p>{safeOrderItems(order).map((item) => `${item.quantity}x ${item.name}`).join(", ")}</p>
            <small>{order.address?.area || "Nearby"} - {order.deliverySlot || "Arriving soon"} - PIN {order.deliveryPin}</small>
            <div className="proofRow">
              <input value={proofPin} onChange={(event) => setProofPin(event.target.value)} placeholder="Enter customer PIN" />
              <button onClick={() => submitProof(order)}>Confirm delivery</button>
            </div>
          </article>
        ))}
        {!(consoleData?.orders || []).length && <p className="emptyInline">No assigned delivery trips right now.</p>}
      </div>
    </section>
  );
}

function AccountView({
  user,
  login,
  logout,
  initialAuthMode,
  topUpWallet,
  openAddress,
  loginWithOtp,
  requestEmailOtp,
  verifyEmailOtp,
  signupWithEmail,
  loginSocial,
  notifications,
  walletHistory,
  updatePreferences,
  updateProfile,
  changeContactWithOtp,
  requestEmailChangeOtp,
  verifyEmailChangeOtp,
  updatePrivacy,
  deactivateAccount,
  deleteAccount,
}) {
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    profilePicture: user?.profilePicture || "",
    language: user?.preferences?.language || "English",
    diet: user?.preferences?.diet || "veg",
  });
  const [emailChangeOtpSent, setEmailChangeOtpSent] = useState(false);
  const [emailChangeOtp, setEmailChangeOtp] = useState("");
  const [emailChangeBusy, setEmailChangeBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        profilePicture: user.profilePicture || "",
        language: user.preferences?.language || "English",
        diet: user.preferences?.diet || "veg",
      });
      setEmailChangeOtpSent(false);
      setEmailChangeOtp("");
    }
  }, [user]);

  const handleEmailChangeOtp = async () => {
    setEmailChangeBusy(true);
    try {
      if (!emailChangeOtpSent) {
        await requestEmailChangeOtp(profileForm.email);
        setEmailChangeOtpSent(true);
        return;
      }
      await verifyEmailChangeOtp(profileForm.email, emailChangeOtp);
      setEmailChangeOtpSent(false);
      setEmailChangeOtp("");
    } finally {
      setEmailChangeBusy(false);
    }
  };

  return (
    <section>
      <div className="sectionHeader">
        <h2>Account and savings</h2>
        <p>Membership, saved addresses, payments, refunds and preferences.</p>
      </div>
      {!user ? (
        <AuthPanel
          login={login}
          initialMode={initialAuthMode}
          loginWithOtp={loginWithOtp}
          requestEmailOtp={requestEmailOtp}
          verifyEmailOtp={verifyEmailOtp}
          signupWithEmail={signupWithEmail}
          loginSocial={loginSocial}
        />
      ) : (
        <>
        <div className="profileCrudPanel">
          <div className="profilePreview">
            <img src={profileForm.profilePicture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop"} alt={profileForm.name} />
            <div>
              <h3>{profileForm.name}</h3>
              <p>{profileForm.email} · {profileForm.phone}</p>
              <small>Status: {user.status || "active"}</small>
            </div>
          </div>
          <div className="profileFormGrid">
            <label>Name<input value={profileForm.name} onChange={(event) => setProfileForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label>Email<input value={profileForm.email} onChange={(event) => setProfileForm((value) => ({ ...value, email: event.target.value }))} /></label>
            {emailChangeOtpSent && (
              <label>Email OTP<input value={emailChangeOtp} onChange={(event) => setEmailChangeOtp(event.target.value)} placeholder="Enter code sent to new email" /></label>
            )}
            <label>Phone<input value={profileForm.phone} onChange={(event) => setProfileForm((value) => ({ ...value, phone: event.target.value }))} /></label>
            <label>Profile picture<input value={profileForm.profilePicture} onChange={(event) => setProfileForm((value) => ({ ...value, profilePicture: event.target.value }))} /></label>
            <label>Language
              <select value={profileForm.language} onChange={(event) => setProfileForm((value) => ({ ...value, language: event.target.value }))}>
                <option>English</option>
                <option>Hindi</option>
                <option>Kannada</option>
              </select>
            </label>
            <label>Dietary preference
              <select value={profileForm.diet} onChange={(event) => setProfileForm((value) => ({ ...value, diet: event.target.value }))}>
                <option value="veg">Veg</option>
                <option value="non-veg allowed">Non-veg allowed</option>
                <option value="vegan">Vegan</option>
              </select>
            </label>
          </div>
          <div className="profileActions">
            <button onClick={() => updateProfile({
              name: profileForm.name,
              profilePicture: profileForm.profilePicture,
            })}>
              Save profile
            </button>
            <button onClick={() => changeContactWithOtp({ phone: profileForm.phone })}>
              Change phone with demo OTP
            </button>
            <button onClick={handleEmailChangeOtp} disabled={emailChangeBusy}>
              {emailChangeOtpSent ? "Verify new email OTP" : "Send real email change OTP"}
            </button>
            <button onClick={() => updatePreferences({ language: profileForm.language, diet: profileForm.diet })}>
              Save preferences
            </button>
            <button className="dangerButton" onClick={deactivateAccount}>
              Soft deactivate
            </button>
          </div>
        </div>

        <div className="accountGrid">
          <div className="accountCard">
            <UserRound size={24} />
            <strong>{user.name}</strong>
            <span>{user.email} · {user.phone}</span>
          </div>
          <button className="accountCard" onClick={openAddress}>
            <MapPin size={24} />
            <strong>Saved addresses</strong>
            <span>{user.addresses?.length || 0} address ready</span>
          </button>
          <div className="accountCard">
            <Gift size={24} />
            <strong>{user.membership?.plan || "QuickPass"}</strong>
            <span>Saved {currency.format(user.membership?.saved || 0)} · {user.loyalty?.points || 0} points</span>
          </div>
          <div className="accountCard">
            <Sparkles size={24} />
            <strong>{user.loyalty?.tier || "Silver"} rewards</strong>
            <span>Use points for coupons and free delivery</span>
          </div>
          <div className="accountCard">
            <Gift size={24} />
            <strong>Referral code {user.referral?.code || "QUICK50"}</strong>
            <span>Earned {currency.format(user.referral?.earned || 0)}</span>
          </div>
          <div className="accountCard">
            <CreditCard size={24} />
            <strong>Payments</strong>
            <span>{user.paymentMethods?.length || 0} methods · Wallet {currency.format(user.wallet?.balance || 0)}</span>
          </div>
          {(user.paymentMethods || []).map((method) => (
            <div className="accountCard" key={`${method.type}-${method.last4}`}>
              <CreditCard size={24} />
              <strong>{method.label}</strong>
              <span>{method.type} · **** {method.last4} {method.default ? "· Default" : ""}</span>
            </div>
          ))}
          <button className="accountCard" onClick={() => topUpWallet(200)}>
            <WalletCards size={24} />
            <strong>Add wallet money</strong>
            <span>Instant demo top-up of Rs 200</span>
          </button>
          <div className="accountCard">
            <Bell size={24} />
            <strong>Push notifications</strong>
            <span>{notifications?.filter((item) => !item.read).length || 0} unread order and deal alerts</span>
          </div>
          <div className="accountCard">
            <ShieldCheck size={24} />
            <strong>Security and devices</strong>
            <span>Device: {user.security?.deviceId || "demo-device-web"} · Encryption on</span>
          </div>
          <button
            className="accountCard"
            onClick={() => updatePrivacy({ privacyMode: !user.security?.privacyMode, multiDeviceAllowed: true })}
          >
            <ShieldCheck size={24} />
            <strong>Privacy mode</strong>
            <span>{user.security?.privacyMode ? "Enabled" : "Disabled"} · multi-device handled</span>
          </button>
          <button
            className="accountCard"
            onClick={() => updatePreferences({ diet: user.preferences?.diet === "veg" ? "non-veg allowed" : "veg" })}
          >
            <SlidersHorizontal size={24} />
            <strong>Food preferences</strong>
            <span>{user.preferences?.diet || "veg"} · {user.preferences?.language || "English"} · {user.preferences?.currency || "INR"}</span>
          </button>
          <div className="accountCard">
            <ReceiptText size={24} />
            <strong>Wallet history</strong>
            <span>{walletHistory?.transactions?.length || 0} transactions · refunds tracked</span>
          </div>
          <button className="accountCard dangerButton" onClick={deleteAccount}>
            <Trash2 size={24} />
            <strong>Delete account</strong>
            <span>Hard delete with DELETE confirmation</span>
          </button>
          <button className="accountCard" onClick={logout}>
            <X size={24} />
            <strong>Logout</strong>
            <span>End this session</span>
          </button>
        </div>
        </>
      )}
    </section>
  );
}

function AuthPanel({ login, initialMode = "emailOtp", loginWithOtp, requestEmailOtp, verifyEmailOtp, signupWithEmail, loginSocial }) {
  const [mode, setMode] = useState(initialMode);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [form, setForm] = useState({
    name: "New Shopper",
    email: "",
    phone: "9000000002",
    password: "quickmart123",
    diet: "veg",
    language: "English",
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleEmailOtp = async () => {
    setAuthBusy(true);
    try {
      if (!emailOtpSent) {
        await requestEmailOtp(form.email, form.name);
        setEmailOtpSent(true);
        return;
      }
      await verifyEmailOtp(form.email, emailOtpCode, form.name, form.phone);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignup = async () => {
    setAuthBusy(true);
    try {
      await signupWithEmail(form);
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <section className="authPanel">
      <div className="authHero">
        <BadgeIndianRupee size={28} />
        <div>
          <h3>Login or create your QuickMart account</h3>
          <p>Email OTP sends a real code to your inbox. Mobile OTP/social are local demo flows.</p>
        </div>
      </div>
      <div className="authSwitchLine">
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>New user registration</button>
        <button className={mode === "emailOtp" ? "active" : ""} onClick={() => setMode("emailOtp")}>Already have account</button>
      </div>

      <div className="authTabs">
        <button className={mode === "emailOtp" ? "active" : ""} onClick={() => setMode("emailOtp")}>Email OTP</button>
        <button className={mode === "mobileOtp" ? "active" : ""} onClick={() => setMode("mobileOtp")}>Mobile OTP</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Email signup</button>
      </div>

      <div className="authForm">
        {(mode === "emailOtp" || mode === "signup") && (
          <label>Email<input value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
        )}
        {mode === "emailOtp" && emailOtpSent && (
          <label>OTP from email<input value={emailOtpCode} onChange={(event) => setEmailOtpCode(event.target.value)} placeholder="Enter 6 digit code" /></label>
        )}
        {(mode === "mobileOtp" || mode === "signup") && (
          <label>Phone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>
        )}
        {mode === "signup" && (
          <>
            <label>Name<input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label>Password<input value={form.password} onChange={(event) => update("password", event.target.value)} /></label>
            <label>Diet
              <select value={form.diet} onChange={(event) => update("diet", event.target.value)}>
                <option value="veg">Veg</option>
                <option value="vegan">Vegan</option>
                <option value="non-veg allowed">Non-veg allowed</option>
              </select>
            </label>
            <label>Language
              <select value={form.language} onChange={(event) => update("language", event.target.value)}>
                <option>English</option>
                <option>Hindi</option>
                <option>Kannada</option>
              </select>
            </label>
          </>
        )}

        <button
          className="primaryButton"
          onClick={() => {
            if (mode === "emailOtp") handleEmailOtp();
            if (mode === "mobileOtp") loginWithOtp();
            if (mode === "signup") handleSignup();
          }}
          disabled={authBusy}
        >
          <UserRound size={18} />
          {mode === "signup"
            ? "Create account"
            : mode === "emailOtp" && emailOtpSent
              ? "Verify email OTP"
              : mode === "emailOtp"
                ? "Send real email OTP"
                : "Continue with mobile OTP 123456"}
        </button>
        {mode === "emailOtp" && emailOtpSent && (
          <button
            className="linkButton"
            onClick={() => {
              setEmailOtpSent(false);
              setEmailOtpCode("");
            }}
          >
            Change email or resend
          </button>
        )}
      </div>

      <div className="authProviders">
        <button onClick={() => loginSocial("google")}>
          <UserRound size={18} />
          Continue with Google
        </button>
        <button onClick={() => loginSocial("apple")}>
          <ShieldCheck size={18} />
          Continue with Apple
        </button>
        <button onClick={() => login("customer")}>
          <ShoppingBag size={18} />
          Guest/demo customer
        </button>
        <button onClick={() => login("admin")}>
          <LayoutDashboard size={18} />
          Admin login
        </button>
      </div>
    </section>
  );
}

function SupportView({ orders, openOrders, raiseIssue }) {
  const latestOrder = orders[0];

  return (
    <section>
      <div className="sectionHeader">
        <h2>Help and issue center</h2>
        <p>Refunds, missing item reports, damaged product support and delivery help.</p>
      </div>
      <div className="supportGrid">
        <button onClick={() => raiseIssue(latestOrder, "Missing item")}>
          <PackageCheck size={22} /> Missing item
        </button>
        <button onClick={() => raiseIssue(latestOrder, "Damaged item refund")}>
          <Trash2 size={22} /> Damaged item refund
        </button>
        <button onClick={() => raiseIssue(latestOrder, "Delivery delay")}>
          <Truck size={22} /> Delivery delay
        </button>
        <button onClick={() => raiseIssue(latestOrder, "Payment issue")}>
          <WalletCards size={22} /> Payment issue
        </button>
      </div>
      <div className="orderCard">
        <div className="orderTop">
          <span><Headphones size={18} /> Recent order support</span>
          <strong>{orders.length} orders</strong>
        </div>
        <p>Open your orders to track, reorder, or raise item-level support.</p>
        {latestOrder?.notes?.supportIssue && (
          <p className="issueNote">Open issue: {latestOrder.notes.supportIssue}</p>
        )}
        <div className="priceRow">
          <span>Average response: under 2 minutes</span>
          <button onClick={openOrders}>Open orders</button>
        </div>
        <div className="faqBox">
          <strong>Help center FAQs</strong>
          <span>Refunds are automated for missing or unavailable items.</span>
          <span>Modify or cancel is available until the order is delivered.</span>
          <span>SMS, email and push alerts are simulated in-app for this demo.</span>
        </div>
      </div>
    </section>
  );
}

function OrdersView({ orders, onReorder, onTrack, onCancel, onRate, onInvoice, onModifyItem, onReplacement }) {
  const totalSpend = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  return (
    <section>
      <div className="sectionHeader">
        <h2>Reorder and track</h2>
        <p>Past orders, spend insights and one-tap restock. Total spend: {currency.format(totalSpend)}.</p>
      </div>
      <div className="ordersList">
        {orders.map((order) => (
          <article className="orderCard" key={order._id}>
            <div className="orderTop">
              <span>
                <ReceiptText size={18} />
                #{shortOrderId(order)}
              </span>
              <strong>{order.status}</strong>
            </div>
            <div className="timeline">
              {safeOrderTimeline(order).map((step) => (
                <span className={step.done ? "done" : ""} key={step.label}>
                  <Check size={14} />
                  {step.label}
                </span>
              ))}
            </div>
            <p>{safeOrderItems(order).map((item) => `${item.quantity}x ${item.name}`).join(", ")}</p>
            {order.deliveryPin && <small className="pinLine">Delivery PIN {order.deliveryPin}</small>}
            {order.partialFulfillment?.hasChanges && (
              <p className="issueNote">Adjusted: {(order.partialFulfillment.unavailableItems || []).join(", ")}</p>
            )}
            <div className="priceRow">
              <strong>{currency.format(order.total)}</strong>
              <div className="orderActions">
                <button onClick={() => onTrack(order)}>
                  <Navigation size={16} />
                  Track
                </button>
                <button
                  onClick={() =>
                    onReorder(
                    safeOrderItems(order).map((item) => ({
                      product: String(item.product),
                      quantity: item.quantity,
                      name: item.name,
                    }))
                    )
                  }
                >
                  <RotateCcw size={16} />
                  Reorder
                </button>
                {canChangeOrder(order) && (
                  <button onClick={() => onCancel(order)}>
                    <X size={16} />
                    Cancel
                  </button>
                )}
                <button onClick={() => onRate(order, 5)}>
                  <Star size={16} />
                  Rate
                </button>
                <button onClick={() => onInvoice(order)}>
                  <ReceiptText size={16} />
                  Invoice
                </button>
                {canChangeOrder(order) && safeOrderItems(order)[0] && (
                  <button onClick={() => onModifyItem(order, safeOrderItems(order)[0], Math.max(safeOrderItems(order)[0].quantity - 1, 0))}>
                    <Minus size={16} />
                    Modify
                  </button>
                )}
                {canChangeOrder(order) && (
                  <button onClick={() => onReplacement(order, "Customer approved closest replacement")}>
                    <PackageCheck size={16} />
                    Replace OK
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const blankProductForm = {
  name: "",
  brand: "",
  category: "Fresh",
  subcategory: "",
  packSize: "",
  price: 1,
  mrp: 1,
  stock: 10,
  etaMinutes: 10,
  discountLabel: "",
  image: "",
  description: "",
};

const blankUserForm = {
  name: "",
  email: "",
  phone: "",
  password: "user12345",
  role: "customer",
  status: "active",
  walletBalance: 0,
  loyaltyPoints: 0,
  diet: "veg",
  language: "English",
  line1: "Admin created address",
  area: "Koramangala",
  city: "Bengaluru",
  pincode: "560034",
  instructions: "",
};

const blankAdminOrderForm = {
  status: "Placed",
  paymentMode: "cod",
  paymentStatus: "pending",
  deliverySlot: "Instant delivery in 12 minutes",
  coupon: "",
  deliveryInstruction: "",
  replacementChoice: "Call before replacing unavailable items",
  supportIssue: "",
  refundStatus: "none",
  subtotal: 0,
  discount: 0,
  deliveryFee: 29,
  tax: 0,
  handlingFee: 6,
  total: 0,
  etaMinutes: 12,
  line1: "",
  area: "",
  city: "Bengaluru",
  pincode: "",
  instructions: "",
};

const blankCouponForm = { code: "", title: "", minCart: 0, discount: 0 };
const blankCampaignForm = { id: "", name: "", status: "Draft", budget: 0, conversion: "New" };
const blankBannerForm = { id: "", title: "", placement: "Home hero", status: "Draft" };
const blankPartnerForm = { id: "", name: "", city: "Bengaluru", status: "Available", rating: 4.5, deliveries: 0 };
const blankStaffForm = { id: "", name: "", role: "Picker", store: "Koramangala Dark Store", ordersPacked: 0 };
const blankZoneForm = { area: "", city: "Bengaluru", eta: 12, available: true };

function AdminManager({ summary, products, reload, reloadAdmin }) {
  const [saving, setSaving] = useState("");
  const [adminPage, setAdminPage] = useState("overview");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(blankProductForm);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [userForm, setUserForm] = useState(blankUserForm);
  const [editingUserId, setEditingUserId] = useState("");
  const [adminOrderForm, setAdminOrderForm] = useState(blankAdminOrderForm);
  const [editingAdminOrderId, setEditingAdminOrderId] = useState("");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUserNotice, setAdminUserNotice] = useState("");
  const [managedCategories, setManagedCategories] = useState(() => summary?.categories || []);
  const [categoryForm, setCategoryForm] = useState({ name: "Breakfast", icon: "🥣", accent: "#0f766e" });
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [marketingData, setMarketingData] = useState({ coupons: [], campaigns: [], banners: [] });
  const [couponForm, setCouponForm] = useState(blankCouponForm);
  const [editingCouponCode, setEditingCouponCode] = useState("");
  const [campaignForm, setCampaignForm] = useState(blankCampaignForm);
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [bannerForm, setBannerForm] = useState(blankBannerForm);
  const [editingBannerId, setEditingBannerId] = useState("");
  const [systemData, setSystemData] = useState({ deliveryPartners: [], storeStaff: [], serviceZones: [] });
  const [partnerForm, setPartnerForm] = useState(blankPartnerForm);
  const [editingPartnerId, setEditingPartnerId] = useState("");
  const [staffForm, setStaffForm] = useState(blankStaffForm);
  const [editingStaffId, setEditingStaffId] = useState("");
  const [zoneForm, setZoneForm] = useState(blankZoneForm);
  const [editingZoneArea, setEditingZoneArea] = useState("");
  const [bulkForm, setBulkForm] = useState({ category: "", stockDelta: 0, etaMinutes: "", sponsored: false });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");
  const [adminEditor, setAdminEditor] = useState(null);

  const categoryOptions = useMemo(() => {
    const names = managedCategories.map((category) => category.name);
    return [...new Set([...names, form.category].filter(Boolean))];
  }, [form.category, managedCategories]);

  const filteredCatalogProducts = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.brand, product.category, product.subcategory]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [catalogSearch, products]);

  const filteredAdminUsers = useMemo(() => {
    const term = adminUserSearch.trim().toLowerCase();
    if (!term) return adminUsers;
    return adminUsers.filter((user) =>
      [user.name, user.email, user.phone, user.role, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [adminUserSearch, adminUsers]);

  useEffect(() => {
    if (summary?.categories?.length) setManagedCategories(summary.categories);
  }, [summary?.categories]);

  const loadAdminUsers = async () => {
    const data = await api("/api/admin/users");
    setAdminUsers(data.users || []);
  };

  const loadAdminUserDetails = async (id) => {
    const data = await api(`/api/admin/users/${id}`);
    setSelectedAdminUser({ ...(data.user || {}), orders: data.orders || [] });
    return data;
  };

  const loadMarketing = async () => {
    const data = await api("/api/admin/marketing");
    setMarketingData(data);
  };

  const loadSystem = async () => {
    const data = await api("/api/admin/system");
    setSystemData(data);
  };

  useEffect(() => {
    loadAdminUsers().catch(() => {});
    loadMarketing().catch(() => {});
    loadSystem().catch(() => {});
  }, []);

  const startCreate = () => {
    setEditingId("");
    setForm(blankProductForm);
    setAdminEditor("product");
  };

  const startEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      brand: product.brand || "",
      category: product.category || "Fresh",
      subcategory: product.subcategory || "",
      packSize: product.packSize || "",
      price: product.price || 1,
      mrp: product.mrp || 1,
      stock: product.stock || 0,
      etaMinutes: product.etaMinutes || 10,
      discountLabel: product.discountLabel || "",
      image: product.image || "",
      description: product.description || "",
    });
    setAdminEditor("product");
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: ["price", "mrp", "stock", "etaMinutes"].includes(field)
        ? Number(value)
        : value,
    }));
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(editingId || "new");
    setCatalogNotice("");

    try {
      await api(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });

      await reload();
      await reloadAdmin();
      setCatalogNotice(editingId ? "Item updated successfully" : "Item created successfully");
      startCreate();
      setAdminEditor(null);
    } catch (error) {
      setCatalogNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const deleteProduct = async (id) => {
    setSaving(id);
    setCatalogNotice("");
    try {
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      await reload();
      await reloadAdmin();
      setCatalogNotice("Item deleted");
      if (editingId === id) startCreate();
    } catch (error) {
      setCatalogNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const updateStock = async (id, stock) => {
    setSaving(id);
    setCatalogNotice("");
    try {
      await api(`/api/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock }),
      });
      await reload();
      setCatalogNotice("Stock updated");
    } catch (error) {
      setCatalogNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const updateOrderStatus = async (id, status) => {
    setSaving(id);
    await api(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (selectedAdminUser?.orders?.some((order) => order._id === id)) {
      await loadAdminUserDetails(selectedAdminUser._id);
    }
    await reloadAdmin();
    setSaving("");
  };

  const addCategory = async () => {
    if (!categoryForm.name.trim()) return;
    setCatalogNotice("");
    const path = editingCategoryName
      ? `/api/admin/categories/${encodeURIComponent(editingCategoryName)}`
      : "/api/admin/categories";
    const data = await api(path, {
      method: editingCategoryName ? "PATCH" : "POST",
      body: JSON.stringify({ ...categoryForm, name: categoryForm.name.trim() }),
    });
    setManagedCategories(data.categories || []);
    setCategoryForm({ name: "", icon: "🛒", accent: "#16a34a" });
    setEditingCategoryName("");
    setAdminEditor(null);
    await reloadAdmin();
  };

  const editCategory = (category) => {
    setEditingCategoryName(category.name);
    setCategoryForm(category);
    setCatalogNotice(`Editing category: ${category.name}`);
    setAdminEditor("category");
  };

  const deleteCategory = async (category) => {
    const data = await api(`/api/admin/categories/${encodeURIComponent(category.name)}`, { method: "DELETE" });
    setManagedCategories(data.categories || []);
    if (editingCategoryName === category.name) {
      setEditingCategoryName("");
      setCategoryForm({ name: "", icon: "🛒", accent: "#16a34a" });
    }
    await reloadAdmin();
  };

  const saveMarketingItem = async (type) => {
    const config = {
      coupons: {
        form: couponForm,
        editing: editingCouponCode,
        base: "/api/admin/coupons",
        id: editingCouponCode,
        reset: () => {
          setCouponForm(blankCouponForm);
          setEditingCouponCode("");
        },
      },
      campaigns: {
        form: campaignForm,
        editing: editingCampaignId,
        base: "/api/admin/campaigns",
        id: editingCampaignId,
        reset: () => {
          setCampaignForm(blankCampaignForm);
          setEditingCampaignId("");
        },
      },
      banners: {
        form: bannerForm,
        editing: editingBannerId,
        base: "/api/admin/banners",
        id: editingBannerId,
        reset: () => {
          setBannerForm(blankBannerForm);
          setEditingBannerId("");
        },
      },
    }[type];

    await api(config.editing ? `${config.base}/${encodeURIComponent(config.id)}` : config.base, {
      method: config.editing ? "PATCH" : "POST",
      body: JSON.stringify(config.form),
    });
    config.reset();
    await loadMarketing();
    await reloadAdmin();
  };

  const deleteMarketingItem = async (type, id) => {
    const base = {
      coupons: "/api/admin/coupons",
      campaigns: "/api/admin/campaigns",
      banners: "/api/admin/banners",
    }[type];
    await api(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadMarketing();
    await reloadAdmin();
  };

  const saveSystemItem = async (type) => {
    const config = {
      partners: {
        form: partnerForm,
        editing: editingPartnerId,
        base: "/api/admin/delivery-partners",
        id: editingPartnerId,
        reset: () => {
          setPartnerForm(blankPartnerForm);
          setEditingPartnerId("");
        },
      },
      staff: {
        form: staffForm,
        editing: editingStaffId,
        base: "/api/admin/store-staff",
        id: editingStaffId,
        reset: () => {
          setStaffForm(blankStaffForm);
          setEditingStaffId("");
        },
      },
      zones: {
        form: zoneForm,
        editing: editingZoneArea,
        base: "/api/admin/service-zones",
        id: editingZoneArea,
        reset: () => {
          setZoneForm(blankZoneForm);
          setEditingZoneArea("");
        },
      },
    }[type];

    await api(config.editing ? `${config.base}/${encodeURIComponent(config.id)}` : config.base, {
      method: config.editing ? "PATCH" : "POST",
      body: JSON.stringify(config.form),
    });
    config.reset();
    await loadSystem();
    await reloadAdmin();
  };

  const deleteSystemItem = async (type, id) => {
    const base = {
      partners: "/api/admin/delivery-partners",
      staff: "/api/admin/store-staff",
      zones: "/api/admin/service-zones",
    }[type];
    await api(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadSystem();
    await reloadAdmin();
  };

  const runBulkProductUpdate = async () => {
    const body = {
      category: bulkForm.category || undefined,
      stockDelta: Number(bulkForm.stockDelta || 0),
      etaMinutes: bulkForm.etaMinutes === "" ? undefined : Number(bulkForm.etaMinutes),
      sponsored: bulkForm.sponsored,
    };
    const data = await api("/api/admin/products/bulk", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setCatalogNotice(`Bulk update applied to ${data.matched} product records`);
    await reload();
    await reloadAdmin();
  };

  const exportCatalog = async () => {
    const data = await api("/api/admin/products/export");
    setCatalogNotice(`Export ready: ${data.count} products, CSV ${data.csv.length} characters`);
  };

  const startUserCreate = () => {
    setEditingUserId("");
    setUserForm({
      ...blankUserForm,
      email: `admin-user-${Date.now().toString().slice(-5)}@quickmart.test`,
      name: "Admin Created User",
    });
    setSelectedAdminUser(null);
    setAdminEditor("user");
  };

  const startUserEdit = async (user) => {
    setAdminUserNotice("");
    const data = await loadAdminUserDetails(user._id);
    const fullUser = data.user;
    setEditingUserId(fullUser._id);
    setUserForm({
      name: fullUser.name || "",
      email: fullUser.email || "",
      phone: fullUser.phone || "",
      password: "user12345",
      role: fullUser.role || "customer",
      status: fullUser.status || "active",
      walletBalance: fullUser.wallet?.balance || 0,
      loyaltyPoints: fullUser.loyalty?.points || 0,
      diet: fullUser.preferences?.diet || "veg",
      language: fullUser.preferences?.language || "English",
      line1: fullUser.addresses?.[0]?.line1 || "",
      area: fullUser.addresses?.[0]?.area || "",
      city: fullUser.addresses?.[0]?.city || "",
      pincode: fullUser.addresses?.[0]?.pincode || "",
      instructions: fullUser.addresses?.[0]?.instructions || "",
    });
    setAdminEditor("user");
  };

  const openUserDetails = async (user) => {
    setAdminUserNotice("");
    await loadAdminUserDetails(user._id);
    setEditingUserId(user._id);
  };

  const updateUserField = (field, value) => {
    setUserForm((current) => ({
      ...current,
      [field]: ["walletBalance", "loyaltyPoints"].includes(field) ? Number(value) : value,
    }));
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setSaving(editingUserId || "user-new");
    setAdminUserNotice("");
    try {
      const data = await api(editingUserId ? `/api/admin/users/${editingUserId}` : "/api/admin/users", {
        method: editingUserId ? "PATCH" : "POST",
        body: JSON.stringify(userForm),
      });
      await loadAdminUsers();
      await reloadAdmin();
      setAdminUserNotice(editingUserId ? "User updated successfully" : "User created successfully");
      if (data.user?._id) {
        const details = await loadAdminUserDetails(data.user._id);
        setEditingUserId(data.user._id);
        setSelectedAdminUser({ ...details.user, orders: details.orders || [] });
      }
      setUserForm(blankUserForm);
      setAdminEditor(null);
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const deactivateUser = async (id) => {
    setSaving(id);
    setAdminUserNotice("");
    try {
      const data = await api(`/api/admin/users/${id}/deactivate`, { method: "PATCH" });
      await loadAdminUsers();
      await reloadAdmin();
      setAdminUserNotice("User deactivated");
      setSelectedAdminUser((current) => (current?._id === id ? { ...current, ...data.user } : current));
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const reactivateUser = async (id) => {
    setSaving(id);
    setAdminUserNotice("");
    try {
      const data = await api(`/api/admin/users/${id}/reactivate`, { method: "PATCH" });
      await loadAdminUsers();
      await reloadAdmin();
      setAdminUserNotice("User reactivated");
      setSelectedAdminUser((current) => (current?._id === id ? { ...current, ...data.user } : current));
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const deleteUser = async (id) => {
    setSaving(id);
    setAdminUserNotice("");
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      await loadAdminUsers();
      await reloadAdmin();
      setAdminUserNotice("User deleted");
      if (editingUserId === id) startUserCreate();
      if (selectedAdminUser?._id === id) setSelectedAdminUser(null);
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const updateAdminOrderField = (field, value) => {
    setAdminOrderForm((current) => ({
      ...current,
      [field]: ["subtotal", "discount", "deliveryFee", "tax", "handlingFee", "total", "etaMinutes"].includes(field)
        ? Number(value)
        : value,
    }));
  };

  const startAdminOrderCreate = () => {
    if (!selectedAdminUser) return;
    const address = selectedAdminUser.addresses?.[0] || {};
    setEditingAdminOrderId("");
    setAdminOrderForm({
      ...blankAdminOrderForm,
      line1: address.line1 || "",
      area: address.area || "",
      city: address.city || "Bengaluru",
      pincode: address.pincode || "",
      instructions: address.instructions || "",
      deliveryInstruction: address.instructions || "",
    });
    setAdminEditor("userOrder");
  };

  const startAdminOrderEdit = (order) => {
    setEditingAdminOrderId(order._id);
    setAdminOrderForm({
      status: order.status || "Placed",
      paymentMode: order.paymentMode || "cod",
      paymentStatus: order.paymentStatus || "pending",
      deliverySlot: order.deliverySlot || "",
      coupon: order.notes?.coupon || "",
      deliveryInstruction: order.notes?.deliveryInstruction || "",
      replacementChoice: order.notes?.replacementChoice || "",
      supportIssue: order.notes?.supportIssue || "",
      refundStatus: order.refundStatus || "none",
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      deliveryFee: order.deliveryFee || 0,
      tax: order.tax || 0,
      handlingFee: order.handlingFee || 0,
      total: order.total || 0,
      etaMinutes: order.etaMinutes || 0,
      line1: order.address?.line1 || "",
      area: order.address?.area || "",
      city: order.address?.city || "",
      pincode: order.address?.pincode || "",
      instructions: order.address?.instructions || "",
    });
    setAdminEditor("userOrder");
  };

  const saveAdminUserOrder = async (event) => {
    event.preventDefault();
    if (!selectedAdminUser) return;
    setSaving(editingAdminOrderId || "admin-order-new");
    setAdminUserNotice("");
    try {
      await api(
        editingAdminOrderId
          ? `/api/admin/orders/${editingAdminOrderId}`
          : `/api/admin/users/${selectedAdminUser._id}/orders`,
        {
          method: editingAdminOrderId ? "PATCH" : "POST",
          body: JSON.stringify(adminOrderForm),
        }
      );
      await loadAdminUserDetails(selectedAdminUser._id);
      await reloadAdmin();
      setAdminUserNotice(editingAdminOrderId ? "Order updated successfully" : "Order created for selected user");
      setAdminEditor(null);
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const deleteAdminUserOrder = async (orderId) => {
    if (!selectedAdminUser) return;
    setSaving(orderId);
    setAdminUserNotice("");
    try {
      await api(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      await loadAdminUserDetails(selectedAdminUser._id);
      await reloadAdmin();
      setAdminUserNotice("Order deleted");
    } catch (error) {
      setAdminUserNotice(error.message);
    } finally {
      setSaving("");
    }
  };

  const adminPages = [
    { key: "overview", label: "Overview", icon: LayoutDashboard, description: "Executive command center" },
    { key: "operations", label: "Operations", icon: Truck, description: "Live orders and delivery" },
    { key: "users", label: "Users", icon: UserRound, description: "Customer CRUD and profiles" },
    { key: "catalog", label: "Catalog", icon: Store, description: "Products, pricing and inventory" },
    { key: "marketing", label: "Marketing", icon: TicketPercent, description: "Coupons, campaigns and banners" },
    { key: "reports", label: "Reports", icon: ReceiptText, description: "Revenue and retention metrics" },
    { key: "system", label: "System", icon: ShieldCheck, description: "Staff, partners and controls" },
  ];

  return (
    <section>
      <div className="sectionHeader">
        <h2>Admin super control system</h2>
        <p>Operations, users, delivery, catalog, promotions, banners and reports in one place.</p>
      </div>
      <nav className="adminPageNav">
        {adminPages.map((page) => {
          const Icon = page.icon;
          return (
            <button
              key={page.key}
              className={adminPage === page.key ? "active" : ""}
              onClick={() => setAdminPage(page.key)}
            >
              <Icon size={18} />
              <span>
                <strong>{page.label}</strong>
                <small>{page.description}</small>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="adminPageHeader">
        <span>Admin page</span>
        <h3>{adminPages.find((page) => page.key === adminPage)?.label}</h3>
        <p>{adminPages.find((page) => page.key === adminPage)?.description}</p>
      </div>
      <div className={adminPage === "overview" ? "adminStats" : "adminStats hidden"}>
        <Stat icon={ShoppingBag} label="Products" value={summary?.productCount || products.length} />
        <Stat icon={ReceiptText} label="Orders" value={summary?.orderCount || 0} />
        <Stat icon={UserRound} label="Customers" value={summary?.userCount || 0} />
        <Stat icon={BadgeIndianRupee} label="Revenue" value={currency.format(summary?.revenue || 0)} />
        <Stat icon={Truck} label="Active orders" value={summary?.activeOrderCount || 0} />
        <Stat icon={Navigation} label="Avg delivery" value={`${summary?.avgDeliveryMinutes || 0} min`} />
        <Stat icon={RotateCcw} label="Retention" value={`${summary?.retentionRate || 0}%`} />
        <Stat icon={SlidersHorizontal} label="Conversion" value={`${summary?.conversionRate || 0}%`} />
      </div>

      <div className="adminControlGrid">
        <AdminPanel page="operations" activePage={adminPage} title="Live orders monitoring" subtitle="Move orders through the ops pipeline.">
          {(summary?.liveOrders || []).length ? (
            summary.liveOrders.map((order) => (
              <div className="opsRow" key={order._id}>
                <span>#{shortOrderId(order)}</span>
                <strong>{order.status}</strong>
                <small>{safeOrderItems(order).length} items · {currency.format(order.total)}</small>
                <button onClick={() => updateOrderStatus(order._id, "Packing")}>Packing</button>
                <button onClick={() => updateOrderStatus(order._id, "Out for delivery")}>Dispatch</button>
                <button onClick={() => updateOrderStatus(order._id, "Delivered")}>Delivered</button>
              </div>
            ))
          ) : (
            <p>No live orders right now.</p>
          )}
        </AdminPanel>

        <AdminPanel page="operations" activePage={adminPage} title="City-wise analytics" subtitle="Demand, revenue and ETA by launch city.">
          {(summary?.cityAnalytics || []).map((city) => (
            <div className="metricRow" key={city.city}>
              <strong>{city.city}</strong>
              <span>{city.orders} orders</span>
              <span>{currency.format(city.revenue)}</span>
              <small>{city.eta} min ETA</small>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="operations" activePage={adminPage} title="Delivery performance" subtitle="SLA, picker speed and refund health.">
          {(summary?.deliveryMetrics || []).map((metric) => (
            <div className="metricRow" key={metric.label}>
              <strong>{metric.label}</strong>
              <span>{metric.value}</span>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="users" activePage={adminPage} title="Customer accounts" subtitle="Recent customers and account health.">
          <div className="userAdminToolbar">
            <input value={adminUserSearch} placeholder="Search users by name, email, phone, role" onChange={(event) => setAdminUserSearch(event.target.value)} />
            <button type="button" onClick={startUserCreate}>Create user</button>
            <span>{filteredAdminUsers.length} of {adminUsers.length} users</span>
          </div>
          {adminUserNotice && <p className="adminNotice">{adminUserNotice}</p>}
          {filteredAdminUsers.map((customer) => (
            <div className="userDetailRow" key={customer._id}>
              <button type="button" className="userSummaryButton" onClick={() => openUserDetails(customer)}>
                <strong>{customer.name}</strong>
                <span>{customer.email}</span>
                <small>{customer.phone || "No phone"} · {customer.role} · {customer.status || "active"} · {customer.loyalty?.points || 0} points</small>
              </button>
              <div className="userRowActions">
                <button type="button" onClick={() => startUserEdit(customer)}>Edit</button>
                {customer.status === "deactivated" ? (
                  <button type="button" onClick={() => reactivateUser(customer._id)} disabled={saving === customer._id}>Reactivate</button>
                ) : (
                  <button type="button" onClick={() => deactivateUser(customer._id)} disabled={saving === customer._id}>Deactivate</button>
                )}
                <button type="button" className="dangerButton" onClick={() => deleteUser(customer._id)} disabled={saving === customer._id}>Delete</button>
              </div>
            </div>
          ))}
          {!filteredAdminUsers.length && <p className="emptyInline">No users match this search.</p>}
        </AdminPanel>

        <AdminPanel page="system" activePage={adminPage} title="Delivery partners" subtitle="Partner assignment and availability.">
          <MarketingCrud
            type="partners"
            title="Delivery partner CRUD"
            items={systemData.deliveryPartners}
            form={partnerForm}
            setForm={setPartnerForm}
            editingId={editingPartnerId}
            setEditingId={setEditingPartnerId}
            save={() => saveSystemItem("partners")}
            remove={(id) => deleteSystemItem("partners", id)}
          />
          {(summary?.deliveryPartners || []).map((partner) => (
            <div className="metricRow" key={partner.name}>
              <strong>{partner.name}</strong>
              <span>{partner.status}</span>
              <small>{partner.city} · {partner.rating}★ · {partner.deliveries} trips</small>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="system" activePage={adminPage} title="Store staff" subtitle="Dark-store picker, inventory and support teams.">
          <MarketingCrud
            type="staff"
            title="Store staff CRUD"
            items={systemData.storeStaff}
            form={staffForm}
            setForm={setStaffForm}
            editingId={editingStaffId}
            setEditingId={setEditingStaffId}
            save={() => saveSystemItem("staff")}
            remove={(id) => deleteSystemItem("staff", id)}
          />
          {(summary?.storeStaff || []).map((staff) => (
            <div className="metricRow" key={staff.name}>
              <strong>{staff.name}</strong>
              <span>{staff.role}</span>
              <small>{staff.store} · {staff.ordersPacked} packed</small>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="system" activePage={adminPage} title="Service zones" subtitle="Delivery availability, cities and ETA controls.">
          <MarketingCrud
            type="zones"
            title="Service zone CRUD"
            items={systemData.serviceZones}
            form={zoneForm}
            setForm={setZoneForm}
            editingId={editingZoneArea}
            setEditingId={setEditingZoneArea}
            save={() => saveSystemItem("zones")}
            remove={(area) => deleteSystemItem("zones", area)}
          />
        </AdminPanel>

        <AdminPanel page="catalog" activePage={adminPage} title="Category management" subtitle="Add/edit/remove category tiles for the storefront.">
          <button type="button" className="primaryButton adminCreateButton" onClick={() => {
            setEditingCategoryName("");
            setCategoryForm({ name: "", icon: "ðŸ›’", accent: "#16a34a" });
            setAdminEditor("category");
          }}>
            <Plus size={18} />
            Create category
          </button>
          <div className="categoryManager">
            {managedCategories.map((category) => (
              <button key={category.name} style={{ "--accent": category.accent }} onClick={() => editCategory(category)}>
                <span>{category.icon}</span>
                {category.name}
                <small>Edit</small>
              </button>
            ))}
          </div>
          <div className="adminInlineForm hidden">
            <label>Category name<input value={categoryForm.name} placeholder="Fruits" onChange={(event) => setCategoryForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label>Icon<input value={categoryForm.icon} placeholder="Icon" onChange={(event) => setCategoryForm((value) => ({ ...value, icon: event.target.value }))} /></label>
            <label>Accent<input value={categoryForm.accent} placeholder="#16a34a" onChange={(event) => setCategoryForm((value) => ({ ...value, accent: event.target.value }))} /></label>
            <button type="button" onClick={addCategory}>{editingCategoryName ? "Save category" : "Add category"}</button>
            {editingCategoryName && <button type="button" className="secondaryButton" onClick={() => { setEditingCategoryName(""); setCategoryForm({ name: "", icon: "🛒", accent: "#16a34a" }); }}>Cancel</button>}
          </div>
          {catalogNotice && <p className="adminNotice">{catalogNotice}</p>}
          <div className="adminCrudList compact">
            {managedCategories.map((category) => (
              <div className="marketingRow" key={`manage-${category.name}`}>
                <strong>{category.icon} {category.name}</strong>
                <span>{category.accent}</span>
                <button type="button" onClick={() => editCategory(category)}>Edit</button>
                <button type="button" className="dangerButton" onClick={() => deleteCategory(category)}>Delete</button>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel page="marketing" activePage={adminPage} title="Promotions and marketing" subtitle="Coupons and campaigns for conversion.">
          <MarketingCrud
            type="coupons"
            title="Coupon CRUD"
            items={marketingData.coupons}
            form={couponForm}
            setForm={setCouponForm}
            editingId={editingCouponCode}
            setEditingId={setEditingCouponCode}
            save={() => saveMarketingItem("coupons")}
            remove={(id) => deleteMarketingItem("coupons", id)}
          />
          <MarketingCrud
            type="campaigns"
            title="Campaign CRUD"
            items={marketingData.campaigns}
            form={campaignForm}
            setForm={setCampaignForm}
            editingId={editingCampaignId}
            setEditingId={setEditingCampaignId}
            save={() => saveMarketingItem("campaigns")}
            remove={(id) => deleteMarketingItem("campaigns", id)}
          />
          {(summary?.coupons || []).map((couponItem) => (
            <div className="metricRow" key={couponItem.code}>
              <strong>{couponItem.code}</strong>
              <span>{couponItem.title}</span>
              <small>Min cart {currency.format(couponItem.minCart)}</small>
            </div>
          ))}
          {(summary?.campaigns || []).map((campaign) => (
            <div className="metricRow" key={campaign.name}>
              <strong>{campaign.name}</strong>
              <span>{campaign.status}</span>
              <small>{currency.format(campaign.budget)} · {campaign.conversion}</small>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="marketing" activePage={adminPage} title="Banner management" subtitle="Home screen ads and placement controls.">
          <MarketingCrud
            type="banners"
            title="Banner CRUD"
            items={marketingData.banners}
            form={bannerForm}
            setForm={setBannerForm}
            editingId={editingBannerId}
            setEditingId={setEditingBannerId}
            save={() => saveMarketingItem("banners")}
            remove={(id) => deleteMarketingItem("banners", id)}
          />
          {(summary?.banners || []).map((banner) => (
            <div className="metricRow" key={banner.title}>
              <strong>{banner.title}</strong>
              <span>{banner.placement}</span>
              <small>{banner.status}</small>
            </div>
          ))}
        </AdminPanel>

        <AdminPanel page="reports" activePage={adminPage} title="Reports and analytics" subtitle="Revenue, conversion, retention and inventory turnover.">
          <div className="reportBars">
            {(summary?.reports?.revenueByDay || []).map((item) => (
              <span key={item.label} style={{ "--height": `${Math.max(18, item.value / 260)}px` }}>
                <i />
                <b>{item.label}</b>
              </span>
            ))}
          </div>
          <div className="metricRow">
            <strong>Inventory turnover</strong>
            <span>{summary?.inventoryTurnover || 0}x</span>
          </div>
          {(summary?.reports?.topInventory || []).slice(0, 5).map((item) => (
            <div className="metricRow" key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.stock} left</span>
              <small>{item.turnover} turnover</small>
            </div>
          ))}
        </AdminPanel>
      </div>

      {adminEditor === "user" && (
        <AdminEditModal
          title={editingUserId ? "Edit user" : "Create user"}
          subtitle="Full account controls, wallet, preferences and delivery address."
          onClose={() => setAdminEditor(null)}
        >
      <form className="adminForm modalForm" onSubmit={saveUser}>
        <div className="formHeader">
          <div>
            <h3>{editingUserId ? "Edit user" : "Create user"}</h3>
            <p>Admin can view full user profile, wallet, preferences, addresses, payments and orders.</p>
          </div>
          <button type="button" className="linkButton" onClick={startUserCreate}>New user</button>
        </div>
        <div className="formGrid">
          <label>Name<input required value={userForm.name} onChange={(event) => updateUserField("name", event.target.value)} /></label>
          <label>Email<input required value={userForm.email} onChange={(event) => updateUserField("email", event.target.value)} /></label>
          <label>Phone<input value={userForm.phone} onChange={(event) => updateUserField("phone", event.target.value)} /></label>
          {!editingUserId && <label>Password<input value={userForm.password} onChange={(event) => updateUserField("password", event.target.value)} /></label>}
          <label>
            Role
            <select value={userForm.role} onChange={(event) => updateUserField("role", event.target.value)}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Status
            <select value={userForm.status} onChange={(event) => updateUserField("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </label>
          <label>Wallet<input type="number" value={userForm.walletBalance} onChange={(event) => updateUserField("walletBalance", event.target.value)} /></label>
          <label>Loyalty points<input type="number" value={userForm.loyaltyPoints} onChange={(event) => updateUserField("loyaltyPoints", event.target.value)} /></label>
          <label>Diet<input value={userForm.diet} onChange={(event) => updateUserField("diet", event.target.value)} /></label>
          <label>Language<input value={userForm.language} onChange={(event) => updateUserField("language", event.target.value)} /></label>
          <label>Address line<input value={userForm.line1} onChange={(event) => updateUserField("line1", event.target.value)} /></label>
          <label>Area<input value={userForm.area} onChange={(event) => updateUserField("area", event.target.value)} /></label>
          <label>City<input value={userForm.city} onChange={(event) => updateUserField("city", event.target.value)} /></label>
          <label>Pincode<input value={userForm.pincode} onChange={(event) => updateUserField("pincode", event.target.value)} /></label>
          <label className="wideField">Instructions<input value={userForm.instructions || ""} onChange={(event) => updateUserField("instructions", event.target.value)} /></label>
        </div>
        <button className="primaryButton" type="submit">
          <UserRound size={18} />
          {saving === "user-new" || saving === editingUserId ? "Saving..." : editingUserId ? "Save user" : "Create user"}
        </button>
      </form>
        </AdminEditModal>
      )}

      {adminPage === "users" && selectedAdminUser && (
        <section className="adminUserDetails">
          <div className="formHeader">
            <div>
              <h3>Full user details</h3>
              <p>{selectedAdminUser.name} · {selectedAdminUser.email}</p>
            </div>
            <div className="crudActions">
              {selectedAdminUser.status === "deactivated" ? (
                <button onClick={() => reactivateUser(selectedAdminUser._id)}>Reactivate</button>
              ) : (
                <button onClick={() => deactivateUser(selectedAdminUser._id)}>Deactivate</button>
              )}
              <button className="dangerButton" onClick={() => deleteUser(selectedAdminUser._id)}>Delete</button>
            </div>
          </div>
          <div className="adminUserInfoGrid">
            <div><strong>Phone</strong><span>{selectedAdminUser.phone || "Not set"}</span></div>
            <div><strong>Role</strong><span>{selectedAdminUser.role}</span></div>
            <div><strong>Status</strong><span>{selectedAdminUser.status || "active"}</span></div>
            <div><strong>Wallet</strong><span>{currency.format(selectedAdminUser.wallet?.balance || 0)}</span></div>
            <div><strong>Cashback</strong><span>{currency.format(selectedAdminUser.wallet?.cashback || 0)}</span></div>
            <div><strong>Loyalty</strong><span>{selectedAdminUser.loyalty?.points || 0} points</span></div>
            <div><strong>Referral</strong><span>{selectedAdminUser.referral?.code || "None"}</span></div>
            <div><strong>Preferences</strong><span>{selectedAdminUser.preferences?.diet || "veg"} · {selectedAdminUser.preferences?.language || "English"}</span></div>
            <div><strong>Addresses</strong><span>{selectedAdminUser.addresses?.map((item) => `${item.label}: ${item.line1}, ${item.area}`).join(" | ") || "None"}</span></div>
            <div><strong>Payments</strong><span>{selectedAdminUser.paymentMethods?.map((item) => `${item.label} ${item.last4}`).join(", ") || "None"}</span></div>
            <div><strong>Wishlist</strong><span>{selectedAdminUser.wishlist?.length || 0} items</span></div>
            <div><strong>Orders</strong><span>{selectedAdminUser.orders?.length || 0} orders</span></div>
          </div>
          <div className="adminUserOrders">
            <div className="formHeader">
              <div>
                <h3>User orders CRUD</h3>
                <p>Create, view, update or delete orders for this selected user.</p>
              </div>
              <button type="button" className="primaryButton" onClick={startAdminOrderCreate}>
                <Plus size={18} />
                Create order
              </button>
            </div>
            {(selectedAdminUser.orders || []).map((order) => (
              <article className="adminOrderCard" key={order._id}>
                <div>
                  <strong>#{shortOrderId(order)} · {order.status}</strong>
                  <span>{order.items?.length || 0} items · {currency.format(order.total || 0)} · {order.paymentMode?.toUpperCase()} / {order.paymentStatus}</span>
                  <small>{order.deliverySlot || "No slot"} · {order.address?.line1 || "No address"}, {order.address?.area || ""}</small>
                </div>
                <div className="adminOrderItems">
                  {(order.items || []).slice(0, 4).map((item) => (
                    <span key={`${order._id}-${item.name}`}>{item.name} x {item.quantity}</span>
                  ))}
                </div>
                <div className="crudActions">
                  <button type="button" onClick={() => startAdminOrderEdit(order)}>Edit order</button>
                  <button type="button" onClick={() => updateOrderStatus(order._id, "Packing")}>Packing</button>
                  <button type="button" onClick={() => updateOrderStatus(order._id, "Delivered")}>Delivered</button>
                  <button type="button" className="dangerButton" onClick={() => deleteAdminUserOrder(order._id)} disabled={saving === order._id}>Delete</button>
                </div>
              </article>
            ))}
            {!selectedAdminUser.orders?.length && <p className="emptyInline">No orders for this user yet. Create one from the button above.</p>}
          </div>
        </section>
      )}

      {adminEditor === "userOrder" && selectedAdminUser && (
        <AdminEditModal
          title={editingAdminOrderId ? "Edit selected user order" : "Create order for selected user"}
          subtitle={`${selectedAdminUser.name} · ${selectedAdminUser.email}`}
          onClose={() => setAdminEditor(null)}
        >
          <form className="adminForm modalForm" onSubmit={saveAdminUserOrder}>
            <div className="formGrid">
              <label>
                Status
                <select value={adminOrderForm.status} onChange={(event) => updateAdminOrderField("status", event.target.value)}>
                  {["Placed", "Packing", "Out for delivery", "Delivered", "Cancelled"].map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Payment mode
                <select value={adminOrderForm.paymentMode} onChange={(event) => updateAdminOrderField("paymentMode", event.target.value)}>
                  <option value="cod">COD</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="wallet">Wallet</option>
                </select>
              </label>
              <label>
                Payment status
                <select value={adminOrderForm.paymentStatus} onChange={(event) => updateAdminOrderField("paymentStatus", event.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>
              <label>Delivery slot<input value={adminOrderForm.deliverySlot} onChange={(event) => updateAdminOrderField("deliverySlot", event.target.value)} /></label>
              <label>Coupon<input value={adminOrderForm.coupon} onChange={(event) => updateAdminOrderField("coupon", event.target.value)} /></label>
              <label>Refund status<input value={adminOrderForm.refundStatus} onChange={(event) => updateAdminOrderField("refundStatus", event.target.value)} /></label>
              <label>Subtotal<input type="number" value={adminOrderForm.subtotal} onChange={(event) => updateAdminOrderField("subtotal", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>Discount<input type="number" value={adminOrderForm.discount} onChange={(event) => updateAdminOrderField("discount", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>Delivery fee<input type="number" value={adminOrderForm.deliveryFee} onChange={(event) => updateAdminOrderField("deliveryFee", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>Tax<input type="number" value={adminOrderForm.tax} onChange={(event) => updateAdminOrderField("tax", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>Handling fee<input type="number" value={adminOrderForm.handlingFee} onChange={(event) => updateAdminOrderField("handlingFee", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>Total<input type="number" value={adminOrderForm.total} onChange={(event) => updateAdminOrderField("total", event.target.value)} disabled={!editingAdminOrderId} /></label>
              <label>ETA minutes<input type="number" value={adminOrderForm.etaMinutes} onChange={(event) => updateAdminOrderField("etaMinutes", event.target.value)} /></label>
              <label>Address line<input value={adminOrderForm.line1} onChange={(event) => updateAdminOrderField("line1", event.target.value)} /></label>
              <label>Area<input value={adminOrderForm.area} onChange={(event) => updateAdminOrderField("area", event.target.value)} /></label>
              <label>City<input value={adminOrderForm.city} onChange={(event) => updateAdminOrderField("city", event.target.value)} /></label>
              <label>Pincode<input value={adminOrderForm.pincode} onChange={(event) => updateAdminOrderField("pincode", event.target.value)} /></label>
              <label className="wideField">Delivery instruction<input value={adminOrderForm.deliveryInstruction} onChange={(event) => updateAdminOrderField("deliveryInstruction", event.target.value)} /></label>
              <label className="wideField">Replacement choice<input value={adminOrderForm.replacementChoice} onChange={(event) => updateAdminOrderField("replacementChoice", event.target.value)} /></label>
              <label className="wideField">Support issue<input value={adminOrderForm.supportIssue} onChange={(event) => updateAdminOrderField("supportIssue", event.target.value)} /></label>
            </div>
            {!editingAdminOrderId && <p className="adminNotice">New admin-created orders use the top in-stock catalog items automatically.</p>}
            <button className="primaryButton" type="submit">
              <ReceiptText size={18} />
              {saving === "admin-order-new" || saving === editingAdminOrderId ? "Saving..." : editingAdminOrderId ? "Save order" : "Create order"}
            </button>
          </form>
        </AdminEditModal>
      )}

      {adminPage === "catalog" && (
        <div className="catalogToolbar">
          <div>
            <strong>Item CRUD</strong>
            <span>{filteredCatalogProducts.length} of {products.length} items shown</span>
          </div>
          <input value={catalogSearch} placeholder="Search item, brand or category" onChange={(event) => setCatalogSearch(event.target.value)} />
          <button type="button" className="linkButton" onClick={startCreate}>Create new item</button>
        </div>
      )}

      {adminPage === "catalog" && (
        <div className="bulkTools">
          <strong>Bulk product tools</strong>
          <select value={bulkForm.category} onChange={(event) => setBulkForm((value) => ({ ...value, category: event.target.value }))}>
            <option value="">All categories</option>
            {categoryOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input type="number" value={bulkForm.stockDelta} onChange={(event) => setBulkForm((value) => ({ ...value, stockDelta: event.target.value }))} placeholder="Stock +/-" />
          <input type="number" value={bulkForm.etaMinutes} onChange={(event) => setBulkForm((value) => ({ ...value, etaMinutes: event.target.value }))} placeholder="ETA minutes" />
          <label><input type="checkbox" checked={bulkForm.sponsored} onChange={(event) => setBulkForm((value) => ({ ...value, sponsored: event.target.checked }))} /> Sponsored</label>
          <button type="button" onClick={runBulkProductUpdate}>Apply bulk update</button>
          <button type="button" onClick={exportCatalog}>Export CSV</button>
        </div>
      )}

      {adminEditor === "category" && (
        <AdminEditModal
          title={editingCategoryName ? "Edit category" : "Create category"}
          subtitle="Control category label, emoji/icon and storefront accent color."
          onClose={() => setAdminEditor(null)}
        >
          <div className="adminInlineForm modalForm">
            <label>Category name<input value={categoryForm.name} placeholder="Fruits" onChange={(event) => setCategoryForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label>Icon<input value={categoryForm.icon} placeholder="Icon" onChange={(event) => setCategoryForm((value) => ({ ...value, icon: event.target.value }))} /></label>
            <label>Accent<input value={categoryForm.accent} placeholder="#16a34a" onChange={(event) => setCategoryForm((value) => ({ ...value, accent: event.target.value }))} /></label>
            <button type="button" onClick={addCategory}>{editingCategoryName ? "Save category" : "Add category"}</button>
          </div>
        </AdminEditModal>
      )}

      {adminEditor === "product" && (
        <AdminEditModal
          title={editingId ? "Edit item" : "Create item"}
          subtitle={editingId ? "Update the selected product." : "Add a new product to the catalog."}
          onClose={() => setAdminEditor(null)}
        >
      <form className="adminForm modalForm" onSubmit={saveProduct}>
        <div className="formHeader">
          <div>
            <h3>{editingId ? "Edit item" : "Create item"}</h3>
            <p>{editingId ? "Update the selected product." : "Add a new product to the catalog."}</p>
          </div>
          <button type="button" className="linkButton" onClick={startCreate}>
            New item
          </button>
        </div>
        <div className="formGrid">
          <label>Name<input required value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Brand<input value={form.brand} onChange={(event) => updateField("brand", event.target.value)} /></label>
          <label>
            Category
            <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              {categoryOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>Subcategory<input value={form.subcategory} onChange={(event) => updateField("subcategory", event.target.value)} /></label>
          <label>Pack size<input required value={form.packSize} onChange={(event) => updateField("packSize", event.target.value)} /></label>
          <label>Price<input required min="1" type="number" value={form.price} onChange={(event) => updateField("price", event.target.value)} /></label>
          <label>MRP<input required min="1" type="number" value={form.mrp} onChange={(event) => updateField("mrp", event.target.value)} /></label>
          <label>Stock<input required min="0" type="number" value={form.stock} onChange={(event) => updateField("stock", event.target.value)} /></label>
          <label>ETA<input min="1" type="number" value={form.etaMinutes} onChange={(event) => updateField("etaMinutes", event.target.value)} /></label>
          <label>Discount<input value={form.discountLabel} onChange={(event) => updateField("discountLabel", event.target.value)} /></label>
          <label className="wideField">Image URL<input value={form.image} onChange={(event) => updateField("image", event.target.value)} /></label>
          <label className="wideField">Description<textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        </div>
        <button className="primaryButton" type="submit">
          <PackageCheck size={18} />
          {saving === "new" || saving === editingId ? "Saving..." : editingId ? "Save item" : "Create item"}
        </button>
        {catalogNotice && <p className="adminNotice">{catalogNotice}</p>}
      </form>
        </AdminEditModal>
      )}

      <div className={adminPage === "catalog" ? "adminCrudList" : "adminCrudList hidden"}>
        {filteredCatalogProducts.map((product) => (
          <article className="crudCard" key={product._id}>
            <ProductImage product={product} />
            <div>
              <strong>{product.name}</strong>
              <span>{product.category} · {product.packSize} · {currency.format(product.price)}</span>
              <small>Stock: {saving === product._id ? "Saving..." : product.stock}</small>
            </div>
            <div className="crudActions">
              <button type="button" onClick={() => startEdit(product)}>Edit</button>
              <button type="button" onClick={() => updateStock(product._id, Math.max(product.stock - 1, 0))}><Minus size={14} /></button>
              <button type="button" onClick={() => updateStock(product._id, product.stock + 1)}><Plus size={14} /></button>
              <button type="button" className="dangerButton" onClick={() => deleteProduct(product._id)}><Trash2 size={14} /></button>
            </div>
          </article>
        ))}
        {!filteredCatalogProducts.length && <p className="emptyInline">No items match this catalog search.</p>}
      </div>
    </section>
  );
}

function AdminPanel({ title, subtitle, children, page, activePage }) {
  if (page && activePage && page !== activePage) return null;

  return (
    <article className="adminPanel">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="adminPanelBody">{children}</div>
    </article>
  );
}

function AdminEditModal({ title, subtitle, children, onClose }) {
  return (
    <div className="overlay adminEditorOverlay">
      <section className="adminEditModal">
        <div className="drawerHeader">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="iconButton" type="button" onClick={onClose}><X /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MarketingCrud({ type, title, items, form, setForm, editingId, setEditingId, save, remove }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const idOf = (item) => item.code || item.id || item.area;
  const startEdit = (item) => {
    setEditingId(idOf(item));
    setForm(item);
    setEditorOpen(true);
  };

  const startNew = () => {
    setEditingId("");
    if (type === "coupons") setForm(blankCouponForm);
    if (type === "campaigns") setForm(blankCampaignForm);
    if (type === "banners") setForm(blankBannerForm);
    if (type === "partners") setForm(blankPartnerForm);
    if (type === "staff") setForm(blankStaffForm);
    if (type === "zones") setForm(blankZoneForm);
    setEditorOpen(true);
  };

  const saveAndClose = async () => {
    await save();
    setEditorOpen(false);
  };

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: ["minCart", "discount", "budget", "rating", "deliveries", "ordersPacked", "eta"].includes(field)
        ? Number(value)
        : field === "available"
          ? value === true || value === "true"
          : value,
    }));
  };

  const fields = {
    coupons: [
      ["code", "Code"],
      ["title", "Title"],
      ["minCart", "Min cart"],
      ["discount", "Discount"],
    ],
    campaigns: [
      ["name", "Name"],
      ["status", "Status"],
      ["budget", "Budget"],
      ["conversion", "Conversion"],
    ],
    banners: [
      ["title", "Title"],
      ["placement", "Placement"],
      ["status", "Status"],
    ],
    partners: [
      ["id", "ID"],
      ["name", "Name"],
      ["city", "City"],
      ["status", "Status"],
      ["rating", "Rating"],
      ["deliveries", "Deliveries"],
    ],
    staff: [
      ["id", "ID"],
      ["name", "Name"],
      ["role", "Role"],
      ["store", "Store"],
      ["ordersPacked", "Orders packed"],
    ],
    zones: [
      ["area", "Area"],
      ["city", "City"],
      ["eta", "ETA"],
      ["available", "Available"],
    ],
  }[type];

  return (
    <div className="marketingCrud">
      <div className="formHeader">
        <div>
          <h3>{title}</h3>
          <p>{(items || []).length} records. Open editor only when needed.</p>
        </div>
        <button
          className="linkButton"
          onClick={startNew}
        >
          New
        </button>
      </div>
      {editorOpen && (
        <AdminEditModal
          title={editingId ? `Edit ${title}` : `Create ${title}`}
          subtitle="Make changes in this focused editor instead of crowding the admin page."
          onClose={() => setEditorOpen(false)}
        >
          <div className="marketingForm modalForm">
            {fields.map(([field, label]) => (
              <label key={field}>
                {label}
                <input value={form[field] ?? ""} onChange={(event) => update(field, event.target.value)} />
              </label>
            ))}
            <button onClick={saveAndClose}>{editingId ? "Save" : "Create"}</button>
          </div>
        </AdminEditModal>
      )}
      <div className="adminCrudList compact">
        {(items || []).map((item) => (
          <div className="marketingRow" key={idOf(item)}>
            <strong>{item.code || item.name || item.title}</strong>
            <span>{item.title || item.status || item.role || item.placement}</span>
            <small>
              {item.minCart
                ? `Min ${currency.format(item.minCart)}`
                : item.budget
                  ? currency.format(item.budget)
                  : item.deliveries !== undefined
                    ? `${item.city} - ${item.rating} star - ${item.deliveries} trips`
                    : item.ordersPacked !== undefined
                      ? `${item.store} - ${item.ordersPacked} packed`
                      : item.eta !== undefined
                        ? `${item.city} - ${item.eta || "No"} min - ${item.available ? "Available" : "Unavailable"}`
                      : item.status}
            </small>
            <button onClick={() => startEdit(item)}>Edit</button>
            <button className="dangerButton" onClick={() => remove(idOf(item))}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminView({ summary, products, reload }) {
  const [saving, setSaving] = useState("");

  const updateStock = async (id, stock) => {
    setSaving(id);
    await api(`/api/admin/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stock }),
    });
    await reload();
    setSaving("");
  };

  return (
    <section>
      <div className="sectionHeader">
        <h2>Store command center</h2>
        <p>Inventory, revenue and stock controls for the nearby dark store.</p>
      </div>
      <div className="adminStats">
        <Stat icon={ShoppingBag} label="Products" value={summary?.productCount || 0} />
        <Stat icon={ReceiptText} label="Orders" value={summary?.orderCount || 0} />
        <Stat icon={UserRound} label="Customers" value={summary?.userCount || 0} />
        <Stat icon={BadgeIndianRupee} label="Revenue" value={currency.format(summary?.revenue || 0)} />
      </div>
      <div className="adminTable">
        {products.map((product) => (
          <div className="adminRow" key={product._id}>
            <ProductImage product={product} />
            <div>
              <strong>{product.name}</strong>
              <span>{product.category} · {product.packSize}</span>
            </div>
            <button onClick={() => updateStock(product._id, Math.max(product.stock - 1, 0))}>
              <Minus size={14} />
            </button>
            <b>{saving === product._id ? "Saving" : product.stock}</b>
            <button onClick={() => updateStock(product._id, product.stock + 1)}>
              <Plus size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="statCard">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
