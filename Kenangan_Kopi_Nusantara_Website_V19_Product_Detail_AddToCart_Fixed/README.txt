KENANGAN KOPI NUSANTARA — V19

This version fixes the Product Detail modal ADD TO CART interaction.

Key fix:
- Product Detail quantity buttons and ADD TO CART are bound after the modal is rendered.
- CTA uses type="button" and explicit click handlers.
- Click propagation is stopped so the scrollable modal/backdrop cannot interfere.
- Cart behavior remains unchanged: adding a regular coffee opens the cart drawer.
- Seasonal coffees remain café-exclusive and cannot be added to the online cart.

Run on Windows:
1. Double-click START-V19.bat
2. Open http://localhost:3000

Or run from this folder:
node backend\server.js
