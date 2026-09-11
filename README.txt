KENANGAN KOPI NUSANTARA — V8 CREATE YOUR COFFEE
Premium customer-facing website refinement.

V8 adds a guided Create Your Coffee journey:
01 choose region → 02 choose bean → 03 discover natural tasting character → optional café brewing experience → café CTA.

Important concept: customers do NOT choose an artificial flavor. Tasting notes are derived from the selected coffee bean.

Files: index.html, styles.css, app.js, assets/
Deploy: upload the contents of this folder to the ROOT of the existing GitHub repository. Vercel will deploy the new commit automatically.
Checkout remains demo-only until production backend/payment is connected.

V9 — COFFEE STORIES
Adds community story cards, ratings, coffee/brew metadata, a Share Your Story form, and localStorage persistence for submitted stories.


V9.1 — COFFEE STORIES UNSEND
User-created stories receive a private local ID and show an UNSEND STORY control. Unsend asks for confirmation, removes the story from this browser's localStorage, and refreshes the community count. Seeded demo stories cannot be unsent.
