import { BrowserRun } from "./browser-session"
import type { FlowCheck, FlowReport } from "./flow-report"

const COUPON = "GLOBAL100"

type Buyer = {
  first: string
  last: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function publicUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error("Enter a full Lovable or live link, including https://")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter a full Lovable or live link, including https://")
  }
  const host = url.hostname.toLowerCase()
  const privateHost =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  if (privateHost) throw new Error("Use the public Lovable or live link.")
  return url.toString()
}

function check(id: string, name: string, ok: boolean, detail: string): FlowCheck {
  return { id, name, status: ok ? "pass" : "fail", detail }
}

export async function runFlowTest(rawUrl: string): Promise<FlowReport> {
  const url = publicUrl(rawUrl)
  const startedAt = new Date().toISOString()
  const stamp = Date.now().toString(36)
  const buyer: Buyer = {
    first: "Quinn",
    last: "Hale",
    email: `promptie.qa.${stamp}@example.com`,
    phone: "2025550148",
    address: "120 Market Street",
    city: "Austin",
    state: "Texas",
    zip: "78701",
  }
  const checks: FlowCheck[] = []
  const browser = await BrowserRun.launch()
  let stripeMode: FlowReport["stripeMode"] = "unknown"
  let couponUsed = false
  let orderId = ""

  try {
    await browser.goto(url)
    checks.push(check("open", "Open the store", true, url))

    checks.push(await responsive(browser, "home-mobile", "Home, phone width", 390, 844, true))
    checks.push(await responsive(browser, "home-desktop", "Home, desktop width", 1280, 800, false))
    await browser.viewport(1280, 800, false)

    const products = await productLinks(browser)
    let added = 0
    let checkedProduct = false
    for (const link of products) {
      if (added >= 2) break
      await browser.goto(link)
      await sleep(700)
      if (!checkedProduct) {
        checks.push(await responsive(browser, "product-mobile", "Product page, phone width", 390, 844, true))
        checks.push(await responsive(browser, "product-desktop", "Product page, desktop width", 1280, 800, false))
        await browser.viewport(1280, 800, false)
        checkedProduct = true
      }
      const result = await addCurrentProduct(browser)
      if (result === "added") added += 1
    }
    checks.push(
      check(
        "products",
        "Add two treatments",
        added >= 2,
        added >= 2
          ? `Added ${added} treatments from product pages.`
          : `Only ${added} treatment could be added. Product pages need a dose or supply, then Add to Cart.`,
      ),
    )

    const cart = await openCart(browser)
    const cartCount = cart ? await cartItemCount(browser) : 0
    checks.push(
      check(
        "cart",
        "Shopping cart",
        cart && cartCount >= 2,
        cart ? `Cart opened with ${cartCount} item${cartCount === 1 ? "" : "s"}.` : "The cart link was not found.",
      ),
    )
    if (cart) {
      checks.push(await responsive(browser, "cart-mobile", "Cart, phone width", 390, 844, true))
      checks.push(await responsive(browser, "cart-desktop", "Cart, desktop width", 1280, 800, false))
      await browser.viewport(1280, 800, false)
    }

    const checkout = cart ? await openCheckout(browser) : false
    checks.push(
      check(
        "checkout",
        "Open checkout",
        checkout,
        checkout ? "Checkout opened from the cart." : "The Checkout button was not found.",
      ),
    )
    if (checkout) {
      checks.push(await responsive(browser, "checkout-mobile", "Checkout, phone width", 390, 844, true))
      checks.push(await responsive(browser, "checkout-desktop", "Checkout, desktop width", 1280, 800, false))
      await browser.viewport(1280, 800, false)
    }

    const filled = checkout ? await fillCheckout(browser, buyer) : 0
    const consents = checkout ? await acceptConsents(browser) : 0
    checks.push(
      check(
        "details",
        "Contact, shipping, and consent",
        filled >= 6 && consents >= 2,
        `Filled ${filled} fields and accepted ${consents} required consent boxes for ${buyer.email}.`,
      ),
    )

    const continued = checkout ? await continueToPayment(browser) : false
    checks.push(
      check(
        "payment-step",
        "Continue to payment",
        continued,
        continued ? "Payment step opened." : "Checkout stayed on contact and shipping.",
      ),
    )

    stripeMode = await detectStripe(browser)
    checks.push(
      check(
        "stripe",
        "Stripe mode",
        stripeMode !== "unknown",
        stripeMode === "live"
          ? "Stripe live key is on the page. Coupon GLOBAL100 will be used."
          : stripeMode === "test"
            ? "Stripe test key is on the page. The coupon will not be used."
            : "No Stripe publishable key was found on the page.",
      ),
    )

    if (stripeMode === "live") {
      couponUsed = await applyCoupon(browser)
      checks.push(
        check(
          "coupon",
          "Coupon GLOBAL100",
          couponUsed,
          couponUsed ? "GLOBAL100 was applied after a valid email because Stripe is live." : "The discount field was not found.",
        ),
      )
    } else if (stripeMode === "test") {
      checks.push(
        check("coupon", "Coupon skipped on Stripe test", true, "GLOBAL100 was not used because Stripe is in test mode."),
      )
      const card = await fillTestCard(browser)
      checks.push(
        check(
          "test-card",
          "Stripe test card",
          card,
          card ? "Test card 4242 was entered." : "Card fields sit in the Stripe payment frame, so the test card was not entered from the page.",
        ),
      )
    } else {
      checks.push(check("coupon", "Coupon decision", false, "Coupon was not used because Stripe mode is unknown."))
    }

    if (checkout) {
      const placed = await placeOrder(browser)
      orderId = placed.orderId
      checks.push(check("order", "Create the order", Boolean(orderId), orderId ? `Order id ${orderId}.` : placed.detail))
    }
    checks.push(check("email", "Mail id used", true, buyer.email))

    await browser.goto(url)
    checks.push(...(await legalChecks(browser)))
  } finally {
    await browser.close()
  }

  return {
    url,
    startedAt,
    finishedAt: new Date().toISOString(),
    stripeMode,
    couponUsed,
    couponCode: couponUsed ? COUPON : "",
    orderId,
    email: buyer.email,
    checks,
  }
}

async function responsive(browser: BrowserRun, id: string, name: string, width: number, height: number, mobile: boolean) {
  await browser.viewport(width, height, mobile)
  await sleep(400)
  const extra = await browser.page.evaluate<number>(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  )
  const ok = extra <= 16
  return check(id, name, ok, ok ? `${width}px fits without sideways scrolling.` : `Page is ${extra}px wider than the ${width}px screen.`)
}

async function productLinks(browser: BrowserRun) {
  return browser.page.evaluate<string[]>(`(() => {
    const hrefs = [...document.querySelectorAll("a")].map((anchor) => anchor.href)
    const seen = new Set()
    const links = []
    for (const href of hrefs) {
      let path = ""
      try {
        path = new URL(href).pathname.replace(/\\/$/, "")
      } catch {
        continue
      }
      const product =
        /^\\/(weight-loss|treatments)\\/[^/]+$/.test(path) ||
        /^\\/(men|women)\\/products\\/[^/]+$/.test(path) ||
        /^\\/(shop|product|products)\\/[^/]+$/.test(path)
      if (!product || seen.has(path)) continue
      seen.add(path)
      links.push(href)
      if (links.length >= 8) break
    }
    return links
  })()`)
}

async function addCurrentProduct(browser: BrowserRun) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await browser.page.evaluate<string>(`(() => {
      const textOf = (node) => (node.innerText || node.value || "").replace(/\\s+/g, " ").trim()
      const root = document.querySelector("main") || document.body
      const writeSelect = (select) => {
        const option = [...select.options].find((item) => item.value)
        if (!option || select.value) return false
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
        setter?.call(select, option.value)
        select.dispatchEvent(new Event("input", { bubbles: true }))
        select.dispatchEvent(new Event("change", { bubbles: true }))
        return true
      }
      const addButton = () =>
        [...root.querySelectorAll("button")].find((button) => /^add to cart\\b/i.test(textOf(button)) && !button.disabled)

      let chose = false
      for (const select of root.querySelectorAll("select")) {
        if (writeSelect(select)) chose = true
      }
      const ready = addButton()
      if (ready) {
        ready.click()
        return "added"
      }
      if (chose) return "chose"

      const dose = [...root.querySelectorAll("button")].find((button) => {
        const label = textOf(button)
        if (!label || button.disabled || button.dataset.promptie || label.length > 48) return false
        return !/add to cart|view cart|get started|coming soon|checkout|continue|apply|remove/i.test(label)
      })
      if (!dose) return "missing"
      dose.dataset.promptie = "1"
      dose.click()
      return "chose"
    })()`)
    if (result === "added") {
      await sleep(900)
      return "added"
    }
    if (result !== "chose") return "missing"
    await sleep(500)
  }
  return "missing"
}

async function openCart(browser: BrowserRun) {
  const clicked = await browser.page.evaluate<boolean>(`(() => {
    const link = document.querySelector('a[aria-label="View cart"]') || [...document.querySelectorAll("a")].find((anchor) => /\\/cart\\/?$/.test(anchor.pathname || ""))
    if (!link) return false
    link.click()
    return true
  })()`)
  if (!clicked) {
    const cartUrl = new URL("/cart", await browser.page.evaluate<string>("location.href"))
    await browser.goto(cartUrl.toString()).catch(() => undefined)
  }
  return waitFor(browser, `(() => /shopping cart|your cart/i.test(document.body.innerText || ""))()`)
}

async function cartItemCount(browser: BrowserRun) {
  return browser.page.evaluate<number>(`(() => {
    const text = document.body.innerText || ""
    const summary = text.match(/subtotal\\s*\\((\\d+)\\s+item/i)
    if (summary) return Number(summary[1])
    const removed = [...document.querySelectorAll("button")].filter((button) => /^remove$/i.test((button.innerText || "").trim())).length
    if (removed) return removed
    return 0
  })()`)
}

async function openCheckout(browser: BrowserRun) {
  const clicked = await browser.page.evaluate<boolean>(`(() => {
    const link = [...document.querySelectorAll("a,button")].find((node) => /^checkout\\b/i.test((node.innerText || "").replace(/\\s+/g, " ").trim()))
    if (!link) return false
    link.click()
    return true
  })()`)
  if (!clicked) return false
  return waitFor(browser, `(() => /contact information|shipping address|shipping details/i.test(document.body.innerText || ""))()`)
}

async function fillCheckout(browser: BrowserRun, buyer: Buyer) {
  const filled = await browser.page.evaluate<number>(`(() => {
    const buyer = ${JSON.stringify(buyer)}
    const labelFor = (field) => {
      const owner = field.closest("div")
      const label = owner?.querySelector("label")
      return [label?.innerText, field.getAttribute("aria-label"), field.placeholder, field.name, field.id, field.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    }
    const write = (field, value) => {
      if (!field || field.disabled || field.readOnly) return false
      const proto = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
      setter?.call(field, value)
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }
    const fields = [...document.querySelectorAll("input,textarea,select")]
    const plan = [
      [/email/, buyer.email],
      [/first/, buyer.first],
      [/last/, buyer.last],
      [/phone|tel/, buyer.phone],
      [/street|address/, buyer.address],
      [/state/, buyer.state],
      [/city/, buyer.city],
      [/zip|postal/, buyer.zip],
    ]
    let count = 0
    const used = new Set()
    for (const [pattern, value] of plan) {
      const field = fields.find((item) => !used.has(item) && pattern.test(labelFor(item)) && !/billing/.test(labelFor(item)))
      if (!field) continue
      used.add(field)
      if (write(field, value)) count += 1
    }
    return count
  })()`)
  await sleep(400)
  return filled
}

async function acceptConsents(browser: BrowserRun) {
  const accepted = await browser.page.evaluate<number>(`(() => {
    const boxes = [...document.querySelectorAll('[role="checkbox"]')]
    let count = 0
    for (const box of boxes) {
      const label = box.getAttribute("aria-label") || ""
      if (!/hipaa authorization|telehealth consent/i.test(label)) continue
      if (box.getAttribute("aria-checked") !== "true") box.click()
      count += 1
    }
    return count
  })()`)
  await sleep(300)
  return accepted
}

async function continueToPayment(browser: BrowserRun) {
  const clicked = await browser.page.evaluate<boolean>(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => /continue to payment/i.test(item.innerText || ""))
    if (!button) return false
    button.click()
    return true
  })()`)
  if (!clicked) return false
  return waitFor(browser, `(() => /place order|payment details|your information/i.test(document.body.innerText || ""))()`)
}

async function detectStripe(browser: BrowserRun) {
  const mode = await browser.page.evaluate<string>(`(() => {
    const frames = [...document.querySelectorAll("iframe")].map((frame) => frame.src).join(" ")
    const text = document.documentElement.innerHTML + " " + frames
    if (text.includes("pk_live_")) return "live"
    if (text.includes("pk_test_")) return "test"
    return "unknown"
  })()`)
  if (mode === "live" || mode === "test") return mode
  return "unknown"
}

async function applyCoupon(browser: BrowserRun) {
  const applied = await browser.page.evaluate<boolean>(`(() => {
    const field = [...document.querySelectorAll("input")].find((input) => /discount code|coupon|promo/i.test([input.placeholder, input.name, input.id, input.getAttribute("aria-label")].join(" ")))
    if (!field) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setter?.call(field, ${JSON.stringify(COUPON)})
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.dispatchEvent(new Event("change", { bubbles: true }))
    const button = [...document.querySelectorAll("button")].find((item) => /^apply$/i.test((item.innerText || "").trim()))
    button?.click()
    return true
  })()`)
  if (applied) await sleep(1200)
  return applied
}

async function fillTestCard(browser: BrowserRun) {
  return browser.page.evaluate<boolean>(`(() => {
    const number = [...document.querySelectorAll("input")].find((input) => /card.?number|cc-number/i.test([input.name, input.id, input.placeholder, input.autocomplete].join(" ")))
    if (!number) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    const write = (field, value) => {
      if (!field) return
      setter?.call(field, value)
      field.dispatchEvent(new Event("input", { bubbles: true }))
    }
    write(number, "4242424242424242")
    const expiry = [...document.querySelectorAll("input")].find((input) => /exp/i.test([input.name, input.id, input.placeholder].join(" ")))
    const cvc = [...document.querySelectorAll("input")].find((input) => /cvc|cvv|security/i.test([input.name, input.id, input.placeholder].join(" ")))
    write(expiry, "1234")
    write(cvc, "123")
    return true
  })()`)
}

async function placeOrder(browser: BrowserRun) {
  const clicked = await browser.page.evaluate<boolean>(`(() => {
    const node = [...document.querySelectorAll("button")].find((item) => /place order/i.test(item.innerText || ""))
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!clicked) return { orderId: "", detail: "The Place order button was not found." }
  const found = await waitForOrder(browser)
  return found.orderId ? found : { orderId: "", detail: "The order id was not on the confirmation page." }
}

async function waitForOrder(browser: BrowserRun) {
  const started = Date.now()
  while (Date.now() - started < 12000) {
    const found = await browser.page
      .evaluate<{ orderId: string; detail: string }>(`(() => {
        let orderId = ""
        const stores = [window.sessionStorage, window.localStorage]
        for (const store of stores) {
          for (let index = 0; index < store.length; index += 1) {
            const key = store.key(index)
            if (!key) continue
            try {
              const data = JSON.parse(store.getItem(key) || "")
              if (Array.isArray(data?.orderIds) && data.orderIds.length) orderId = String(data.orderIds[0])
              else if (data?.orderId) orderId = String(data.orderId)
              else if (data?.order_id) orderId = String(data.order_id)
            } catch {
              /* not order json */
            }
          }
        }
        const text = document.body.innerText || ""
        if (!orderId) {
          const match = text.match(/order\\s*(?:id|number|#)\\s*[:#]?\\s*([A-Z0-9-]{4,})/i)
          if (match) orderId = match[1]
        }
        return { orderId, detail: text.slice(0, 240) }
      })()`)
      .catch(() => ({ orderId: "", detail: "" }))
    if (found.orderId) return found
    await sleep(500)
  }
  return { orderId: "", detail: "" }
}

async function legalChecks(browser: BrowserRun) {
  const links = await browser.page.evaluate<{ id: string; name: string; href: string }[]>(`(() => {
    const wanted = [
      ["privacy", "Privacy policy", /\\/privacy\\b/i],
      ["terms", "Terms of service", /\\/terms\\b/i],
      ["telehealth", "Telehealth consent", /telehealth/i],
      ["hipaa-notice", "HIPAA notice", /hipaa-notice/i],
      ["hipaa-authorization", "HIPAA authorization", /hipaa-authorization/i],
      ["returns", "Returns and refunds", /\\/returns\\b|refund/i],
    ]
    const anchors = [...document.querySelectorAll("a")]
    return wanted.map(([id, name, pattern]) => {
      const found = anchors.find((anchor) => pattern.test(anchor.pathname || "") || pattern.test(anchor.href || ""))
      return { id, name, href: found?.href || "" }
    })
  })()`)
  const checks: FlowCheck[] = []
  for (const link of links) {
    if (!link.href) {
      checks.push(check(`legal-${link.id}`, link.name, false, "No footer link was found."))
      continue
    }
    await browser.goto(link.href).catch(() => undefined)
    const length = await browser.page.evaluate<number>("(document.body.innerText || '').trim().length").catch(() => 0)
    checks.push(check(`legal-${link.id}`, link.name, length > 80, length > 80 ? link.href : "The page opened without policy text."))
  }
  return checks
}

async function waitFor(browser: BrowserRun, expression: string, ms = 8000) {
  const started = Date.now()
  while (Date.now() - started < ms) {
    const ready = await browser.page.evaluate<boolean>(expression).catch(() => false)
    if (ready) return true
    await sleep(400)
  }
  return false
}
