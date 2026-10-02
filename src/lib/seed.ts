import type { Database } from "./types"

const stripeBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: integrate Stripe into the existing codebase. Match the current architecture, folder structure, and coding style. Do not redesign the product.

Product context:
{{product_summary}}

Stack: {{stack}}
Implement this Stripe mode first: {{stripe_mode}}
Currency: {{currency}}
Payment methods: {{payment_methods}}
Checkout style: {{checkout_style}}

Requirements:
- Add Stripe only where money moves. Leave unrelated flows alone.
- Use the official Stripe API and the current recommended integration for this stack.
- Implement server-side payment creation that matches {{checkout_style}}, a webhook endpoint that verifies signatures, and persistence of payment status on the existing order or subscription model.
- Handle these webhook events: {{webhook_events}}.
- Never trust client-side payment success. Fulfill the order only after a verified webhook.
- Keep secret keys on the server. Document required environment variables by name only. Do not invent secret values.
- Make webhook handling idempotent so retries do not double-fulfill.
- Customer-facing copy uses the brand name {{brand_name}}.

Before writing code:
1. Inspect the repo and name the files you will change.
2. State the payment fields you will store.
3. Then implement.

When done, list the changed files, the environment variables, and how to test in Stripe test mode.`

const papBody = `You are a senior engineer working inside {{project_name}} for the brand {{brand_name}}.

Task: integrate PAP (Post Affiliate Pro) so referred visits and successful payments are attributed to affiliates. Match the existing codebase. Do not replace the current checkout.

Product context:
{{product_summary}}

Stack: {{stack}}
PAP merchant URL: {{pap_url}}
Tracking method: {{tracking_method}}
Commission event: {{commission_event}}
Cookie window: {{cookie_window}}

Requirements:
- Capture the affiliate click id from the landing URL using this tracking method: {{tracking_method}}. Persist it with the visitor or account.
- When this happens — {{commission_event}} — send a server-side sale or lead to PAP with the order id, the amount, and the campaign if the product already has those fields.
- Use the brand {{brand_name}} on any affiliate-facing labels.
- Do not double-report the same order. Make the tracking call idempotent on order id.
- Keep PAP credentials on the server. List environment variables by name only.
- If a click id is missing, the purchase still completes. A tracking failure must not block checkout.

Before writing code, inspect how {{project_name}} handles signup and payment success, and name the hook points. Then implement.

When done, list the changed files, the environment variables, and a test plan that starts from a sample affiliate link.`

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
          "Add Stripe checkout, verified webhooks, and payment status to the current product.",
        body: stripeBody,
        updatedAt: now,
      },
      {
        id: "tpl_pap",
        title: "PAP integration",
        category: "Affiliates",
        description:
          "Attribute referred visits and payments to Post Affiliate Pro without blocking checkout.",
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
    ],
    companies: [
      {
        id: "co_northwind",
        name: "Northwind",
        updatedAt: now,
        values: {
          brand_name: "Northwind",
          project_name: "northwind-app",
          product_summary:
            "B2B software sold as a subscription on the web. Buyers already have accounts.",
          stack: "Next.js, TypeScript, Postgres",
          stripe_mode: "test",
          currency: "usd",
          payment_methods: "card",
          checkout_style: "Stripe Checkout, hosted session",
          webhook_events:
            "checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted",
          pap_url: "https://affiliates.northwind.example",
          tracking_method: "PAP click id on the landing URL, stored on the account",
          commission_event: "the first successful payment",
          cookie_window: "30 days",
          payment_provider: "Stripe",
          purchase_type: "a subscription plan",
          tax_handling: "tax exclusive, calculated on the server",
          customer_fields: "name, work email, and billing country",
        },
      },
      {
        id: "co_harbor",
        name: "Harbor",
        updatedAt: now,
        values: {
          brand_name: "Harbor",
          project_name: "harbor-billing",
          product_summary: "A consumer shop that sells kits and a membership.",
          stack: "Next.js, TypeScript, Postgres",
        },
      },
    ],
  }
}
