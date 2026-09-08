# RankPath GitHub Website Export

GitHub-ready static website export with a root `index.html` and a dedicated `seo-checker.html`.

## Files

- `index.html` — RankPath homepage
- `seo-checker.html` — Free On-Page SEO Checker UI
- `styles.css` — all responsive styling
- `app.js` — checker/report/lead/payment UI logic
- `config.js` — backend + Omise connection settings
- `assets/` — RankPath logo and hero image

## GitHub Pages

1. Create a GitHub repository.
2. Upload all files in this folder to the repository root.
3. In GitHub: Settings → Pages → Deploy from a branch.
4. Select your main branch and `/ (root)`.
5. Save.

`index.html` is already in the repository root, so GitHub Pages can load it automatically.

## Live SEO Checker

GitHub Pages is static hosting. Browsers generally cannot fetch and analyse arbitrary third-party websites directly because of CORS and security restrictions.

Deploy the RankPath scanner backend separately (FastAPI/Node/VPS/Render/Railway/etc.), then set:

```js
window.RANKPATH_CONFIG = {
  API_BASE: "https://your-api-domain.com",
  OMISE_PAYMENT_LINK: "",
  REPORT_PRICE_THB: 800
};
```

The front end expects:

- `POST /api/analyze` — website audit
- `POST /api/lead` — Fix This Issue lead form
- `POST /api/create-checkout` — returns `{ "checkout_url": "https://..." }`

With no `API_BASE`, the SEO Checker opens in preview/demo mode so the UX can still be reviewed on GitHub Pages.

## Omise / Opn payment — 800 THB export

Two supported setups are already wired into the front end:

### A. Payment Links+ (simplest)
Create a fixed 800 THB payment link in your Omise/Opn account and paste it into `OMISE_PAYMENT_LINK` in `config.js`.

### B. Backend-created checkout
Set `API_BASE`. The export button sends a request to `/api/create-checkout`. Your backend should create the payment securely and return a checkout URL.

Do **not** put your Omise secret key in `config.js`, `app.js`, `index.html`, or any public GitHub file.

## Before production

- Replace example canonical/domain values.
- Add your real privacy policy and terms.
- Connect analytics and consent management if required.
- Connect the live SEO backend.
- Connect Omise/Opn checkout and verify payment before enabling PDF export.
- Avoid serving the PDF purely from a public static URL; generate or authorise access after confirmed payment.
