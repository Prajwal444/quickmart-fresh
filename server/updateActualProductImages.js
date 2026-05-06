require("dotenv").config();

const https = require("https");
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Order = require("./models/Order");
const { productImageUrl } = require("./imageCatalog");

const blockedHosts = [
  "pinterest.",
  "facebook.",
  "instagram.",
  "youtube.",
  "twitter.",
  "x.com",
  "pinimg.",
  "encrypted-tbn",
  "gstatic.",
  "googleusercontent.",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestText = (url, timeout = 15000) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          Accept: "text/html,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => resolve({ data, response }));
      }
    );
    request.setTimeout(timeout, () => {
      request.destroy(new Error("Request timed out"));
    });
    request.on("error", reject);
  });

const requestHead = (url, timeout = 10000, redirects = 0) =>
  new Promise((resolve) => {
    const request = https.request(
      url,
      {
        method: "HEAD",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      },
      (response) => {
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && location && redirects < 3) {
          response.resume();
          const nextUrl = new URL(location, url).toString();
          requestHead(nextUrl, timeout, redirects + 1).then(resolve);
          return;
        }
        response.resume();
        resolve(response);
      }
    );
    request.setTimeout(timeout, () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
    request.end();
  });

const decodeHtml = (value = "") =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u002f/g, "/")
    .replace(/\\u003a/g, ":")
    .replace(/\\u0026/g, "&");

const isBlocked = (url) => {
  const lower = url.toLowerCase();
  return (
    blockedHosts.some((host) => lower.includes(host)) ||
    lower.includes("user-login") ||
    lower.includes("placeholder") ||
    lower.includes("defaultimage")
  );
};

const imageLooksUsable = async (url) => {
  if (!/^https:\/\//i.test(url) || isBlocked(url)) return false;
  const response = await requestHead(url);
  if (!response || response.statusCode < 200 || response.statusCode >= 400) return false;
  const contentType = String(response.headers["content-type"] || "");
  return contentType.startsWith("image/");
};

const searchImage = async (product) => {
  const query = [product.brand, product.name, product.packSize, "product image"].filter(Boolean).join(" ");
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
  const { data } = await requestText(url);
  const matches = [...data.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);

  for (const candidate of matches.slice(0, 12)) {
    if (await imageLooksUsable(candidate)) {
      return candidate;
    }
  }

  return productImageUrl(product.category, product.name, product.brand, product.subcategory);
};

const updateImages = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");

  await mongoose.connect(process.env.MONGO_URI);
  const products = await Product.find().sort({ category: 1, name: 1 });
  const imageById = new Map();
  const results = [];

  for (const [index, product] of products.entries()) {
    try {
      const image = await searchImage(product);
      product.image = image;
      product.gallery = [image];
      await product.save();
      imageById.set(String(product._id), image);
      results.push({ name: product.name, brand: product.brand, image });
      console.log(`[${index + 1}/${products.length}] ${product.brand} ${product.name} -> ${image}`);
    } catch (error) {
      const fallback = productImageUrl(product.category, product.name, product.brand, product.subcategory);
      product.image = fallback;
      product.gallery = [fallback];
      await product.save();
      imageById.set(String(product._id), fallback);
      console.log(`[${index + 1}/${products.length}] fallback ${product.brand} ${product.name}: ${error.message}`);
    }
    await sleep(120);
  }

  let orderUpdates = 0;
  for (const order of await Order.find()) {
    let changed = false;
    order.items = (order.items || []).map((item) => {
      const image = item.product ? imageById.get(String(item.product)) : null;
      if (image && item.image !== image) {
        item.image = image;
        changed = true;
      }
      return item;
    });
    if (changed) {
      await order.save();
      orderUpdates += 1;
    }
  }

  console.log(`Updated ${products.length} products and ${orderUpdates} orders.`);
  await mongoose.disconnect();
  return results;
};

updateImages().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
