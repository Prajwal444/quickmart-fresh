# QuickMart Fresh

An original MERN quick-commerce grocery app inspired by common instant-delivery patterns: fast location-aware shopping, category discovery, offers, cart progress nudges, checkout, order tracking, reorder, membership-style savings, and admin inventory controls.

This is not a Swiggy clone and does not use Swiggy branding, proprietary assets, or copied UI. It uses the old MERN ecommerce project only as a technical reference for auth, products, orders, and checkout shape.

## Run

```powershell
npm install
npm install --prefix client
npm run seed
npm run build
npm start
```

Open `http://localhost:4100`.

## Demo Accounts

- Customer: `customer@quickmart.test` / `customer123`
- Admin: `admin@quickmart.test` / `admin123`

## Features

- Location-first grocery storefront
- Search suggestions and filtered catalog
- Quick category rail and full category view
- Sale banners, wallet/membership savings, free delivery progress
- Product cards with stock, ETA, discounts, veg markers, replacement hints
- Cart drawer, quantity controls, delivery instructions
- Checkout with address, payment mode, coupon, and delivery slot
- Order tracking timeline and reorder
- Admin dashboard for inventory, stock, order status, and analytics
