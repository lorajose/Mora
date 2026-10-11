# MORA Family participation service

This is a standalone app-proxy backend, not an installed Shopify app. No real votes, ratings or comments are accepted until it is deployed and connected to an installed Shopify app. Keep the theme's participation setting off until end-to-end testing succeeds.

## Activation requirements

1. Create/link a Shopify app using Shopify CLI in the merchant's developer organization. Configure distribution for the MORA store and the minimal write_app_proxy scope. No Admin API/customer/order scopes are needed by this service.
2. Host this Node 24 service behind HTTPS with a persistent, private SQLite volume. A single service instance is supported; do not use ephemeral/serverless storage or multiple replicas with independent databases. Back up the database daily.
3. Store that app's API secret in server-side SHOPIFY_API_SECRET. Never put it in Liquid, browser JavaScript, GitHub, or chat. Set SHOPIFY_SHOP_DOMAIN to d1xg7s-q3.myshopify.com.
4. Configure the app proxy URL to the service HTTPS /proxy path, prefix apps, subpath mora-family. Install the app on MORA and deploy its proxy configuration.
5. Test storefront requests at /apps/mora-family/catalog after OTP sign-in and for guests. Shopify must forward a signed logged_in_customer_id for the authenticated member. Never fall back to a customer ID supplied by browser code.
6. Enable participation_enabled in both Coming Soon and Home showcase sections only after verifying persistence, duplicate votes, member/guest separation, comment moderation, and expiry/re-login.

Shopify documentation: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies

## Operation

Run npm test, then npm start from this directory with environment variables configured. Use npm run moderate -- pending, approve ID or reject ID on the server. Comments show only after approval. Public responses never include customer IDs, emails or names. One editable moderated comment, one rating and one vote per customer per design. Votes are reversible and retry-safe. Rating does not affect vote ranking. Ties use stable design IDs.

Edit ../../assets/mora-coming-soon-catalog.json to add designs. Stable IDs must never be recycled. A coming-soon design can receive feedback; change status to closed to remove it from voting and ranking. Re-deploy the same catalog to the theme and service together. The service does not create purchasable products, set inventory, accept money or launch products automatically.

Handle Shopify privacy/compliance webhooks in the installed app: erase the associated customer with the store.erase function after verifying Shopify's webhook signature; process data requests and shop redaction according to retention policy. Do not activate the installed app without these handlers. Local erase-customer is available for verified manual requests. On uninstall disable participation and stop the service.

## Validation before launch

Test member versus guest, forged signatures, stale timestamps, duplicate authentication keys, expired/cross-customer CSRF, repeated votes, ratings outside 1–5, comments with HTML, edits returning to moderation, more than three designs ranked by votes, restart persistence, and store/password/new-account behavior. The current repository's automated tests exercise backend logic; they do not prove installed proxy/login behavior.
