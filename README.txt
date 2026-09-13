KENANGAN KOPI NUSANTARA — V23 INTERACTIONS FIXED

Run START-V21.bat on Windows, then open http://localhost:3000

V21 fixes:
- Product Detail ADD TO CART uses robust delegated click handling.
- Product Detail quantity +/- remains clickable.
- Explore Origin cards use delegated interaction and keyboard support.
- SELECTED ORIGINS coffee buttons use data-action interaction.
- Dynamic Shop VIEW and ADD TO CART buttons use data-action interaction.
- Existing backend and seasonal café-exclusive cart restriction retained.

V21: added individual persuasive coffee tasting descriptions for all 45 coffees in Product Detail.

V23 interaction fix: Seasonal “DISCOVER THIS COFFEE →” buttons now use delegated data-action handling, so all 5 seasonal cards reliably open Product Detail.

V24 UPDATE
- Journal READ STORY buttons are now fully interactive.
- Added three journal article modals: Natural vs Washed, Five Indonesian Coffee Origins, and Brewing Guide.
- Added keyboard Escape support for the journal modal.

V25 FIX: Journal READ STORY buttons now use both direct onclick handlers and delegated data-action handling, with pointer-event/z-index hardening.
