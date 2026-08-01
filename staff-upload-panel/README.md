# Staff Upload Panel — for gsengh24/tavusha2

I checked your repo (github.com/gsengh24/tavusha2). It's a static site
(index.html, shop.html, css/styles.css, js/products.js, js/main.js) with
products hardcoded in a TAVUSHA_PRODUCTS array — no backend yet.

**Nothing in your existing repo is touched.** index.html, shop.html,
css/styles.css, js/products.js, js/main.js are untouched. No line in them
is edited.

## What to add to your repo
Copy these into the root of tavusha2:
```
staff.html                 <- new page, not linked from your nav (staff open it directly)
css/staff-panel.css        <- new file, only styles the new portal - reuses your
                              existing CSS variables (--black, --warm-grey, --border,
                              --font-display, --radius-pill, etc.) from css/styles.css,
                              so it matches your look automatically without copying it
```
Plus the backend/ folder anywhere you like (it's a separate Node service, not
part of the static site - see below).

staff.html links css/styles.css directly (your real stylesheet), so fonts,
colours, buttons and the nav bar look exactly like the rest of TAVUSHA. I did
not recreate or guess your colours/fonts - the page inherits them live.

## Backend (new, separate service)
```
backend/            Node.js + Express + MongoDB API - staff logins, permissions,
                     product upload with image crop/resize/quality (sharp),
                     admin approve/reject workflow
```
Setup:
```bash
cd backend
npm install
cp .env.example .env     # set MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm start
```
First run auto-creates the Main Admin login from .env. Update API_BASE near
the top of staff.html to point at wherever this backend ends up hosted
(e.g. Render, Railway, a VPS - anywhere Node can run; GitHub Pages alone can't
run this backend since it only serves static files).

## Requirement -> where it lives
| Client requirement | Implementation |
|---|---|
| Alag login/password per staff | Staff model, admin creates logins from the Staff tab |
| Limited permission per staff | 4 toggleable permissions (upload/edit/delete/stock) |
| Upload photos/videos/price/colour/size | Upload form in staff.html -> POST /api/products |
| Crop/resize/quality | Drag-crop box in the form -> sharp processes on the backend |
| Category matches your shop filters | Product has category: party/ethnic/casual/maxi/coord |
| Stock update | Included in edit; lighter permission for quick updates |
| Edit/remove wrong product | Staff can edit/remove their own uploads |
| Admin checks/approves/edits/deletes | Every staff upload/edit is pending until admin approves |
| Mobile, no laptop needed | Single responsive page, camera opens directly on upload |

## Getting approved products onto shop.html (optional, your call)
Right now staff.html is a fully working back-office - staff upload, admin
approves - but approved products don't show on shop.html yet, because that
page currently reads only the hardcoded TAVUSHA_PRODUCTS array in
js/products.js, and I didn't want to touch that file without you confirming.

The backend already exposes a ready-made bridge for this, in the same data
shape your site already uses:
```
GET /api/products/storefront.js
```
This returns approved products as a script that appends to TAVUSHA_PRODUCTS -
it doesn't replace or rewrite anything. To go live, the only change needed
is one new script tag added after js/products.js in shop.html and index.html:
```html
<script src="js/products.js"></script>
<script src="https://YOUR-BACKEND-URL/api/products/storefront.js"></script>
<script src="js/main.js"></script>
```
That's a one-line addition, not a design or logic change - say the word and
I'll do it, or your developer can drop it in whenever you're ready.

## Security notes before going live
- Strong random JWT_SECRET and ADMIN_PASSWORD in .env (never commit .env)
- Serve the backend over HTTPS
- Rate-limit /api/auth/login against brute-force attempts
- Move uploads/ to cloud storage (S3, Cloudinary) once you're past testing
