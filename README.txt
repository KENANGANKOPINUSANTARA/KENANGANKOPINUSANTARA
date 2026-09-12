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
