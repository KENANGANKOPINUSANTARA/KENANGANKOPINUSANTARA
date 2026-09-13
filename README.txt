KENANGAN KOPI NUSANTARA — V30
MY ORDERS PRODUCT MAPPING FIX

V30 is based on V28 and fixes an order-history mapping bug.

FIX:
- My Orders now resolves coffee details by the actual coffee name first.
- Missing product IDs no longer cause every item to match the first product in the catalog.
- Existing local orders are supported without needing to place the order again.
- Correct region, processing method and product artwork are shown for each coffee.

Example:
Puntang / Ciwidey / Garut / Pangalengan will correctly show JAWA BARAT instead of SUMATERA.

This remains a prototype/demo architecture with localStorage fallback for static/Vercel deployment.


V32 FIX: Order Receipt modal now uses a higher stacking layer than My Orders, so View Receipt always opens in front of the My Orders modal.

V33 — EDITORIAL PHOTOGRAPHY ASSETS
- Added local editorial photography assets under assets/photos/.
- Homepage hero, origins, shop banner, seasonal, create, finder, stories, journal and cafe now use local visuals.
- Existing V32 account, checkout, orders and receipt behavior is preserved.
- Product data and order-name-first mapping are preserved.

V34 VISUAL UPDATE
- Updated the Jawa Timur origin photography with a high-resolution Ijen/Raung-inspired volcanic landscape.
- Removed the incorrect Flores Bajawa visual from the Jawa Timur origin card.
- The Jawa Timur card continues to represent the Ijen Raung / East Java collection.
