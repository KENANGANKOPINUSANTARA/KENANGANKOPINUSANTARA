JAWA TENGAH IMAGE FIX
=======================

This package fixes the broken Jawa Tengah / Origin 03 image.

INSTALL:
1. Extract this ZIP.
2. Copy the `assets` folder into the ROOT of your GitHub website repository.
3. If GitHub asks whether to replace/merge the folder, choose MERGE/REPLACE.
4. Make sure the final path is exactly:

   assets/jateng.svg

5. Commit and push to GitHub, then wait for Vercel to redeploy.

No app.js change is required because the existing code already points to:
assets/jateng.svg
