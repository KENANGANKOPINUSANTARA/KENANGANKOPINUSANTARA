KENANGAN KOPI NUSANTARA — V12 ACCOUNT SYSTEM

V12 adds a local development account system.
- Register / Login / Logout
- Passwords stored as scrypt hashes in backend/db.json
- Story ownership via authorId
- Users can edit/unsend only their own stories
- Share Story requires login
- Session token is stored in browser localStorage for this development build

RUN
1. Double-click START-V12.bat
2. Open http://localhost:3000

IMPORTANT
This is still a local development backend. Before production, move authentication to Supabase/PostgreSQL or another managed auth service, add secure cookies/session handling, email verification, password reset, rate limiting, CSRF protection, and production secrets.
