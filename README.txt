KENANGAN KOPI NUSANTARA — V27
Account + Checkout resilience for local Node and Vercel/static deployment.

LOCAL MODE
1. Double-click START-V27.bat
2. Open http://localhost:3000

VERCEL / STATIC MODE
- Account creation/login falls back to a browser-local demo account when /api/auth is unavailable.
- Checkout falls back to browser-local demo orders when /api/orders is unavailable.
- Local Node backend remains the preferred persistent mode.

V27 fixes:
- Create Account works without the V12/V26 backend error on deployed/static mode.
- Login works in local demo mode.
- Session survives page refresh in the same browser.
- Checkout submission is implemented.
- Local orders are stored for the current browser account when API is unavailable.
- My Orders loads API orders or local fallback orders.
- Search modal and Journal modal interactions are restored.

IMPORTANT
The browser fallback is for prototype/demo use. For production, connect the site to a real persistent database/auth service.
