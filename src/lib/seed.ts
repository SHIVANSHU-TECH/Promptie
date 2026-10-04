import type { Database } from "./types"

const stripeBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: implement Stripe the same way the Totara Health submit checkout does it, adapted to this repo. Compare it with the Koverx Stripe checkout only to keep the shared contract. Do not redesign the product.

Product context:
{{product_summary}}

Stack: {{stack}}
API base URL: {{api_base_url}}
Currency: {{currency}}
Payment method types, as a JSON array: {{payment_methods}}

Keys. These two must belong to the same Stripe account. Do not invent replacements and do not commit them.
- Publishable key (pk), frontend only: {{stripe_publishable_key}}
- Secret key (sk), server only: {{stripe_secret_key}}
- Webhook signing secret, server only: {{stripe_webhook_secret}}

Put the pk in the frontend env (REACT_APP_STRIPE_PUBLISHABLE_KEY or this stack's public env). Put the sk in the server env as STRIPE_SECRET_KEY. The browser never sees the sk.

Flow, in this order:
1. The buyer completes shipping name and address before pay is enabled.
2. The frontend POSTs a PaymentIntent and receives clientSecret.
3. Load Stripe.js with the pk and confirm the Payment Element. Card plus the methods listed above. Klarna locale en-US. Exclude Link. Do not enable automatic_payment_methods.
4. Retrieve the PaymentIntent with the client secret. Continue only when status is succeeded and the id matches.
5. POST the create-order API with payment_token set to that PaymentIntent id. A declined or incomplete payment must not create a paid order.
6. Verify the webhook signature with the webhook secret. Fulfillment stays idempotent on the PaymentIntent id.

PaymentIntent endpoint: POST {{api_base_url}}/stripe/create-payment-intent
Content-Type: application/json
Amount is an integer in the smallest currency unit, minimum 50.

Request body:
{
  "email": "",
  "firstName": "",
  "lastName": "",
  "name": "",
  "productName": "",
  "sku": "",
  "amount": 0,
  "currency": "{{currency}}",
  "productId": "",
  "phone": "",
  "address": "",
  "city": "",
  "state": "",
  "zip": "",
  "country": "US",
  "shipping": { "name": "", "address": { "line1": "", "line2": "", "city": "", "state": "", "postal_code": "", "country": "US" } },
  "shipping_name": "",
  "shipping_address_line1": "",
  "shipping_city": "",
  "shipping_state": "",
  "shipping_zip": "",
  "shipping_country": "US",
  "billing_details": { "name": "", "email": "", "phone": "", "address": { "line1": "", "line2": "", "city": "", "state": "", "postal_code": "", "country": "US" } },
  "amount_details": { "line_items": [{ "product_name": "", "unit_cost": 0, "quantity": 1 }] },
  "payment_method_options": { "klarna": { "preferred_locale": "en-US" } },
  "setup_future_usage": null,
  "excluded_payment_method_types": ["link"],
  "payment_method_types": {{payment_methods}},
  "automatic_payment_methods": { "enabled": false },
  "coupon": "",
  "promo_codes": "",
  "metadata": { "promo_code": "", "referralId": "", "papVisitorId": "", "papCookie": "", "papAffiliateId": "", "papProductKey": "", "productFamily": "", "planMonths": "", "sku": "", "productId": "", "productName": "" }
}

Read clientSecret from clientSecret, client_secret, data.clientSecret, data.client_secret, result.clientSecret, or result.client_secret. If the route 404s, say the backend route is missing. Do not fake a client secret.

Create-order endpoint: POST {{api_base_url}}/createOrder_stripe
Call it only after the PaymentIntent status is succeeded. payment_token is the PaymentIntent id.

Request body:
{
  "email": "",
  "first_name": "",
  "last_name": "",
  "phone": "",
  "address": "",
  "address2": "",
  "city_name": "",
  "state_name": "",
  "zip_code": "",
  "billingSameAsShipping": "YES",
  "billing_address": "",
  "billing_address2": "",
  "billing_city_name": "",
  "billing_state_name": "",
  "billing_zip_code": "",
  "start_url": "",
  "payment_token": "",
  "promo_codes": null,
  "product_id": 0,
  "product_price": "",
  "original_price": "",
  "campaign_id": "",
  "contact_details_id": "",
  "checkout_link_id": "",
  "admin_id": "",
  "shipping_id": "",
  "new_shipping_id": "",
  "shipping_cost": "",
  "shipping_code": "",
  "sms_transactional": 0,
  "sms_marketing": 0,
  "referralId": "",
  "papVisitorId": "",
  "papCookie": "",
  "papAffiliateId": "",
  "papProductKey": "",
  "productFamily": "",
  "planMonths": "",
  "sku": "",
  "productName": "",
  "orderValue": "",
  "meta_fbp": "",
  "meta_fbc": "",
  "meta_event_id": "",
  "meta_client_user_agent": "",
  "meta_event_source_url": ""
}

When the cart has more than one product, send product_id as an array of ids and omit product_price and original_price. That is the Totara Health submit contract. If this backend already expects Koverx fields product_id_arr, product_price_arr, and original_price_arr, keep those instead of inventing a third shape.

billingSameAsShipping is "YES" or "NO". When it is NO, billing_* comes from the billing form. Phone is digits only. Do not create a second order if the buyer refreshes after success.

Before writing code, name the files you will change and which of the two product-id shapes this backend already uses. Then implement.

When done, list the changed files, where the pk and sk were stored, and how to test with Stripe test cards.`

const papBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: add Post Affiliate Pro click tracking and sale tracking the way the Totara Health submit checkout does, using the scripts below. Do not replace checkout and do not invent a different tracker URL.

Product context:
{{product_summary}}

Stack: {{stack}}
PAP merchant URL: {{pap_url}}
PAP account id: {{pap_account_id}}
Cookie domain, including the leading dot: {{cookie_domain}}

Click script. Load this exact URL. Script id must be pap_x2s6df8d:
{{pap_click_script}}

Sales script. This is the merchant-panel snippet. Use these calls, with the real order values substituted:
{{pap_sales_script}}

Click tracking:
- On first load and on every in-app route change, run the click script. Skip thank-you and success URLs so a confirmation view is not counted as a new click.
- Read the affiliate from the query a_aid or ref, and from the hash #a_aid, #a_bid, or a shorthand hash that is only an affiliate id. Promote hash values into the query so the tracker can see them. Persist a_aid and a_bid for the session.
- After the script loads, set the cookie domain to {{cookie_domain}}, set the account id to {{pap_account_id}}, then call PostAffTracker.track().
- Read the PAPVisitorId cookie. The full cookie is the account prefix plus a 32-character visitor id. When the cookie is 40 characters or longer, the visitor id sent onward is the last 32 characters. Also keep the full cookie.
- Store the visitor id in localStorage and sessionStorage. If the script is blocked or the cookie never appears, checkout still completes.

Pass these fields on the PaymentIntent metadata and on the create-order body when they exist: papVisitorId, papCookie, papAffiliateId, papProductKey, productFamily, planMonths. A missing click must not block payment.

Sale tracking, only after Stripe payment has succeeded:
- Load the same click-script URL if PostAffTracker is not already on the page.
- Set the account id, then createSale().
- setTotalCost to the order amount with two decimals.
- setOrderID to the PaymentIntent id, so a later server sale can decline a duplicate.
- setProductID to the product id string from the order.
- If the pasted sales script includes setCustomCommission, call it with that value. Do not invent a commission amount.
- Call PostAffTracker.register() once per order id. Remember the id in sessionStorage so a refresh does not register the sale again.
- A tracking error is logged and does not fail the order.

Before writing code, find the landing layout and the thank-you page and name where track() and register() will run. Then implement.

When done, list the changed files and a test that starts from an affiliate link with a_aid, lands on checkout, pays, and shows one PAP sale for that PaymentIntent id.`

const checkoutBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: implement the internal checkout. Reuse the existing auth, cart, and order models. Do not send the buyer to a third-party hosted checkout page.

Product context:
{{product_summary}}

Stack: {{stack}}
Payment provider behind the checkout: {{payment_provider}}
What the buyer purchases: {{purchase_type}}
Tax handling: {{tax_handling}}
Required customer fields: {{customer_fields}}

Requirements:
- Build the checkout UI in the product's existing design system, branded as {{brand_name}}.
- The buyer reviews the order, enters {{customer_fields}}, pays through {{payment_provider}}, and lands on a confirmed state tied to a real order record.
- Calculate prices, taxes ({{tax_handling}}), and totals on the server.
- Create or update the order before payment is confirmed. Mark it paid only after {{payment_provider}} confirms payment.
- Enforce stock, plan, or seat limits that already exist in {{project_name}}.
- A failed or cancelled payment leaves an order the buyer can retry. Refreshing the page must not create a duplicate order.
- Include empty, loading, and error states on every step.

Before writing code, map the current cart, order, and payment code and list the files you will change. Then implement.

When done, describe the path a buyer walks and list the files changed.`

const metaBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: add the Meta Pixel in the browser and a matching Conversions API Purchase on the server, the way the Totara Health submit checkout does it. One purchase must count once.

Product context:
{{product_summary}}

Stack: {{stack}}
Meta Pixel id: {{meta_pixel_id}}
Graph API version: {{meta_api_version}}
Currency: {{currency}}
Server CAPI access token, server only: {{meta_capi_token}}

Browser:
- Install the pixel with {{meta_pixel_id}} and fire PageView once on load. Use the standard fbevents.js snippet. Do not put the CAPI access token in frontend code or in the pixel snippet.
- Fire these browser events with fbq('track', name, customData, { eventID }):
  - InitiateCheckout when checkout starts. eventID is InitiateCheckout plus a timestamp and a short random suffix.
  - AddPaymentInfo when the buyer submits payment details.
  - Purchase on the thank-you page after the order exists. eventID is Purchase_ plus the order id. The same id is sent to the server.
- custom_data may contain only value, currency {{currency}}, content_type "product", content_ids, contents (id, quantity, item_price), num_items, and order_id. Do not send quiz answers, BMI, goal weight, medication names, prescription status, or any other health information.
- Read cookies _fbp and _fbc, plus the user agent and the page URL. Send them on the create-order request as meta_fbp, meta_fbc, meta_event_id, meta_client_user_agent, and meta_event_source_url.

Server:
- After Stripe and the order API both confirm the order, send a Purchase to https://graph.facebook.com/{{meta_api_version}}/{{meta_pixel_id}}/events using {{meta_capi_token}}.
- Use the same event_id as the browser Purchase so Meta deduplicates to one conversion.
- Include the fbp, fbc, client user agent, and event source URL forwarded from checkout. Do not include health fields.
- If the token or pixel id is missing, skip CAPI and still show the thank-you page.

Before writing code, find where checkout starts and where the thank-you page reads the order id. Then implement.

When done, list the changed files, confirm the access token is only on the server, and describe how to verify one Purchase in Meta Test Events.`

const analyticsBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: add GA4 ecommerce events through the dataLayer, and the Google Ads tag, the way the Totara Health submit checkout does. Match the existing checkout. Do not send health or quiz data.

Product context:
{{product_summary}}

Stack: {{stack}}
Currency: {{currency}}
Google Ads tag id: {{google_ads_id}}
GTM or GA4 measurement id, if this project already uses one: {{gtm_id}}

Load gtag.js once with {{google_ads_id}}. Configure that id. Do not insert the script again on later route changes.

Push these dataLayer events. Before each one, push { ecommerce: null } so the previous ecommerce object is cleared.

1. ce_begin_checkout when checkout starts.
2. ce_add_payment_info when the buyer submits payment details. payment_type is the method they used, default "Credit Card".
3. ce_purchase on the thank-you page after the order exists. transaction_id is the PaymentIntent id or the order id this project already stores. Fire it once per transaction id.

Each ecommerce object includes currency {{currency}}, value with two decimals, coupon, and items. Each item has item_id, item_name, item_category, item_brand, price, and quantity 1. Spread a cart discount across items by price so the item prices still add up to the charged value.

ce_purchase also includes tax, shipping, customer_type, and user_data: first_name, last_name, email, phone, external_id, city, state, zip, country, date_of_birth, gender. Escape quotes and newlines in those strings. Omit a field when it is empty. Do not add medication, BMI, or quiz answers.

If {{gtm_id}} is set, load that container as well and do not also hardcode a second measurement id.

Before writing code, find the checkout start, the pay submit, and the thank-you page. Then implement.

When done, list the changed files and the three event names a test order should push.`

const endorselyBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: capture the Endorsely referral and send it with the order, the way the Totara Health submit checkout does. Do not block checkout when the script is missing.

Product context:
{{product_summary}}

Stack: {{stack}}
Endorsely account id: {{endorsely_id}}

In the document head, load https://assets.endorsely.com/endorsely.js once, async, with data-endorsely="{{endorsely_id}}".

On checkout, read window.endorsely_referral. If it is present, store it in localStorage under endorsely_referral. If the window value is empty, fall back to that stored value.

Send the value as referralId on the PaymentIntent metadata and on the create-order body. A missing referral still completes payment.

Do not invent a commission amount in the browser. Endorsely campaign rates stay on the Endorsely side.

Before writing code, find the order payload builder and the page head. Then implement.

When done, list the changed files and how to test with a referral present and with the script blocked.`

const pricingBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: add a protected Admin Pricing Dashboard by copying the ShapeMeds architecture. Do not invent a second pricing system. Do not redesign the site. Do not change checkout, cart, Stripe, payment processing, product names, product ids, SKUs, checkout URLs, product mappings, intake, labs, marketing pages, header, or footer.

Product context:
{{product_summary}}

Stack: {{stack}}

Fixed server-side site id. Never read this from the browser and never swap in another brand's site id:
{{site_id}}

Admin sign-in. Store these only in server environment variables. Do not put them in client code or in a public env prefix.
- Username: {{admin_username}}
- Password: {{admin_password}}
- Session secret: {{admin_session_secret}}

Pricing API token. Server only. The browser must never see it and must never call panel.whitelabelmd.com itself:
{{api_authtoken}}

Follow the ShapeMeds split:
- A server-only module owns the WhiteLabelMD calls. ShapeMeds uses src/lib/wlmd-prices.server.ts. The .server suffix, or this project's equivalent, keeps the token out of the client bundle.
- Admin login, session, price read, and price update are server functions. ShapeMeds uses src/lib/admin.functions.ts with an httpOnly session, an 8 hour max age, and assertAdmin before every price read or update.
- The public customer price read is a separate server function. ShapeMeds uses src/lib/prices.functions.ts. It returns checkout-id to product_price and never caches or invents a price.
- Routes are /admin/login and /admin/prices. Unauthenticated visitors are redirected to login. Login is noindex.

GET current prices. POST, not GET:
https://panel.whitelabelmd.com/wlmdbackend/api/get_product_prices

Headers, server-side only:
authtoken: {{api_authtoken}}
Accept: application/json
content-type: application/x-www-form-urlencoded

Body. product_id is one comma-separated string, never a JSON array. Build the id list from the existing {{brand_name}} catalog. Do not stop at a sample of three ids. ShapeMeds sends them in chunks of 150 with cache: no-store.
site_id={{site_id}}
product_id=2,5,6

Success is status = 1. Map product_id to product_price. That map is the Current Price. Do not show a hardcoded price.

Also POST https://panel.whitelabelmd.com/wlmdbackend/api/get_products with the same headers and site_id={{site_id}}. ShapeMeds uses this list for the dashboard rows: uniq_id, sticky_product_id, product_name, product_sku, product_price. The update call must use sticky_product_id. Resolve that id on the server from this list. The client sends only the catalog product id. If uniq_id and sticky_product_id are the same, send that value. If they differ, send sticky_product_id. Do not invent ids and do not change the catalog.

Update. POST, server-side only:
https://panel.whitelabelmd.com/wlmdbackend/api/update_product_price

Body, form-urlencoded:
site_id={{site_id}}
product_id=<sticky_product_id>
price=<new price>

Success is status = 1. Show product_price from that response immediately, clear the input, and show the API message. On failure, leave Current Price unchanged, show the API message, and enable the button again. Handle 401 unauthorized, invalid site id, invalid product id, invalid price, 404 product not found, missing site credentials, and Sticky update failed.

Validate the new price the way ShapeMeds does: digits with an optional decimal of one or two places, and the number must be greater than 0. Allow 190, 190.5, 190.50, and 199.99. Reject 0, negatives, letters, extra dots, and more than two decimal places.

The table columns are Product ID, Product Name, SKU, Current Price, New Price, and Action. Each row has its own Update button. While one row saves, disable only that button. The rest of the table stays usable.

After a refresh, Current Price must come from get_product_prices again. The customer-facing pages must use the same live-price server function, with no static fallback that overrides the backend price.

Do not modify the Pro Player Solutions project.

Before writing code, name the files you will add and confirm the browser will not call update_product_price. Then implement.

When done, list the files, confirm site_id {{site_id}} is server-side only, confirm the authtoken never reaches the client bundle, and describe a two-product update plus refresh test.`

const legitBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: add the LegitScript seal to the existing footer. Match the markup used on koverx.com and biomaxrx.com. Do not redesign the footer.

Stack: {{stack}}
Brand domain, without www: {{brand_domain}}
This brand's LegitScript seal id: {{legitscript_seal_id}}

Koverx uses checker_keywords=koverx.com and biomaxrx.com uses checker_keywords=biomaxrx.com. Each site must verify its own domain. Do not reuse another brand's domain or seal id.

Place this in the footer, as plain HTML or the project's link component:

<a href="https://www.legitscript.com/websites/?checker_keywords={{brand_domain}}" target="_blank" rel="noopener noreferrer" title="Verify LegitScript Approval for www.{{brand_domain}}">
  <img src="https://static.legitscript.com/seals/{{legitscript_seal_id}}.png" alt="Verify LegitScript Approval for www.{{brand_domain}}" width="73" height="79" loading="lazy" />
</a>

The link opens in a new tab. The image is lazy loaded. Do not change checkout, navigation, or other footer links.

When done, name the footer file and confirm the checker_keywords value is {{brand_domain}}.`

const ghlBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: store the questionnaire as each field is completed, then send one webhook when the plans page opens. Do not change checkout, plans, payment, GTM, Meta Pixel, or order logic.

Stack: {{stack}}
Site id: {{site_id}}
Webhook URL: {{ghl_webhook_url}}

As the visitor finishes each field, persist that value for the session. Do this for first name, last name, email, phone, and every other questionnaire answer. A later field must not erase earlier ones.

When the plans page opens, POST once to {{ghl_webhook_url}}. Use a session flag so a refresh or a second visit to the plans page does not send again. A missing optional field is an empty string or null, as in the sample. Do not block the plans page if the webhook fails.

The JSON keys must stay exactly these. Fill them from the stored questionnaire, the page URL, and the click ids already on the session. site_id is always {{site_id}}.

{
  "site_id": "{{site_id}}",
  "state": "",
  "first_name": "",
  "last_name": "",
  "email": "",
  "email_consent": "",
  "phone": "",
  "sms_consent": "",
  "dob": "",
  "gender": "",
  "bmi": null,
  "weight_current": null,
  "weight_goal": null,
  "taking_weight_loss_meds": "",
  "weight_loss_medications_currently_taking": "",
  "medication_trying_to_get": "",
  "source_url": "",
  "click_id": "",
  "utm_source": "",
  "utm_medium": "",
  "utm_term": "",
  "utm_campaign": "",
  "utm_content": "",
  "fbclid": "",
  "google_click_id": "",
  "msclkid": "",
  "medication_dose": "",
  "ed_prior_treatments": "",
  "ed_problem_duration": ""
}

email_consent and sms_consent are "yes" or "no". dob stays YYYY-MM-DD. bmi and the weight fields are numbers or null.

Before writing code, find the questionnaire field handlers and the plans page mount. Then implement.

When done, list the files and how to confirm one POST per session with the stored first name, last name, and phone.`

export function seedDatabase(): Database {
  const now = Date.now()
  return {
    version: 1,
    selectedCompanyId: "co_northwind",
    activeTemplateId: "tpl_stripe",
    templates: [
      {
        id: "tpl_stripe",
        title: "Stripe integration",
        category: "Payments",
        description:
          "PaymentIntent, then createOrder, with the pk and sk for this brand.",
        body: stripeBody,
        updatedAt: now,
      },
      {
        id: "tpl_pap",
        title: "PAP integration",
        category: "Affiliates",
        description:
          "PAP click script on landing and the sales script after a successful payment.",
        body: papBody,
        updatedAt: now,
      },
      {
        id: "tpl_checkout",
        title: "Internal checkout",
        category: "Payments",
        description:
          "Build an in-product checkout on the existing order model, with the payment provider behind it.",
        body: checkoutBody,
        updatedAt: now,
      },
      {
        id: "tpl_meta",
        title: "Meta Pixel",
        category: "Tracking",
        description:
          "Browser pixel plus a server Purchase that shares one event id.",
        body: metaBody,
        updatedAt: now,
      },
      {
        id: "tpl_ga4",
        title: "GA4 and Google Ads",
        category: "Tracking",
        description:
          "dataLayer begin-checkout, add-payment-info, and purchase, plus the Google Ads tag.",
        body: analyticsBody,
        updatedAt: now,
      },
      {
        id: "tpl_endorsely",
        title: "Endorsely referral",
        category: "Affiliates",
        description:
          "Load the Endorsely script and pass the referral id through checkout.",
        body: endorselyBody,
        updatedAt: now,
      },
      {
        id: "tpl_pricing",
        title: "Admin pricing dashboard",
        category: "Pricing",
        description:
          "ShapeMeds-style admin login and live price update, with this brand's site id.",
        body: pricingBody,
        updatedAt: now,
      },
      {
        id: "tpl_legit",
        title: "LegitScript seal",
        category: "Trust",
        description:
          "Footer LegitScript link and seal for this brand's own domain.",
        body: legitBody,
        updatedAt: now,
      },
      {
        id: "tpl_ghl",
        title: "Plans page webhook",
        category: "Tracking",
        description:
          "Store each questionnaire answer, then POST once when the plans page opens.",
        body: ghlBody,
        updatedAt: now,
      },
    ],
    companies: [],
  }
}
