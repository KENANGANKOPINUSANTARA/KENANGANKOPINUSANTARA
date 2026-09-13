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
