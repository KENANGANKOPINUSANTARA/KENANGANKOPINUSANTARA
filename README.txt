KENANGAN KOPI NUSANTARA — V13 ORDER & CHECKOUT

V13 adds a real local order flow on top of V12 Account System.

Features:
- Cart quantity and remove controls
- Login required for checkout
- Customer and shipping form
- POST /api/orders
- Order persistence in backend/db.json
- Stock validation and decrement
- Seasonal products blocked from online ordering
- Order confirmation number
- My Orders inside account
- GET /api/products with stock data

Run on Windows: double-click START-V13.bat
Or: node backend/server.js
Then open http://localhost:3000

Shipping in this prototype is a flat Rp20.000. Payment gateway is intentionally not connected yet.

V15 — PRODUCT CARD ACTIONS
- Product cards now use a fixed action grid.
- Price, VIEW, and ADD TO CART stay on one consistent row on desktop/tablet.
- Button widths are standardized for visual consistency.
- Product info uses a minimum height so action rows remain visually aligned.
- Responsive layout remains supported on smaller screens.


V17: Product card action layout fixed globally. Price is always on its own row, with VIEW and ADD TO CART on a separate two-button row, preventing overlap at all desktop card widths.

V18 — PRODUCT DETAIL + CART FLOW
- Product detail modal upgraded with origin, process, variety, tasting notes, format and quantity controls.
- Regular coffees can be added with a selected quantity directly from Product Detail.
- Seasonal coffees remain café-exclusive and cannot be added to the online cart.
- Cart now has cleaner item controls, subtotal, empty state, remove controls and checkout state.
- Legacy seasonal cart entries are automatically removed from localStorage.
- Existing account, stories and backend order flow are preserved.
