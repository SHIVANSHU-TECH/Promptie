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
    state: "TX",
    zip: "78701",
  }
  const checks: FlowCheck[] = []
  const browser = await BrowserRun.launch()
  let stripeMode: FlowReport["stripeMode"] = "unknown"
  let couponUsed = false
  let orderId = ""

  try {
    await browser.goto(url)
    checks.push(check("open", "Open the store", true, browser ? url : url))

    checks.push(await responsive(browser, "home-mobile", "Home, phone width", 390, 844, true))
    checks.push(await responsive(browser, "home-desktop", "Home, desktop width", 1280, 800, false))
    await browser.viewport(1280, 800, false)

    const added = await addProducts(browser)
    checks.push(check("products", "Add multiple products", added >= 2, added >= 2 ? `Added ${added} products.` : `Only ${added} product could be added.`))

    const cart = await openCart(browser)
    checks.push(check("cart", "View cart", cart, cart ? "Cart page opened." : "No cart link or cart page was found."))
    if (cart) checks.push(await responsive(browser, "cart-mobile", "Cart, phone width", 390, 844, true))

    const checkout = await openCheckout(browser)
    checks.push(check("checkout", "Open checkout", checkout, checkout ? "Checkout opened." : "Checkout could not be opened."))

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

    const filled = await fillCheckout(browser, buyer)
    checks.push(check("details", "Random checkout details", filled > 2, `Filled ${filled} checkout fields for ${buyer.email}.`))

    if (stripeMode === "live") {
      couponUsed = await applyCoupon(browser)
      checks.push(
        check(
          "coupon",
          "Coupon GLOBAL100",
          couponUsed,
          couponUsed ? "GLOBAL100 was entered because Stripe is live." : "The coupon field was not found.",
        ),
      )
    } else if (stripeMode === "test") {
      checks.push(check("coupon", "Coupon skipped on Stripe test", true, "GLOBAL100 was not used because Stripe is in test mode."))
      const card = await fillTestCard(browser)
      checks.push(check("test-card", "Stripe test card", card, card ? "Test card 4242 was entered." : "The Stripe test card fields were not found."))
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
    const legal = await legalChecks(browser)
    checks.push(...legal)
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

async function addProducts(browser: BrowserRun) {
  let added = await clickMatches(browser, "add to cart|add to bag|add product")
  if (added >= 2) return added
  const links = await browser.page.evaluate<string[]>(`() => {
    const hrefs = [...document.querySelectorAll("a")].map((anchor) => anchor.href)
    return [...new Set(hrefs.filter((href) => /product|treatment|shop/i.test(href)))].slice(0, 4)
  }`)
  for (const link of links) {
    if (added >= 2) break
    await browser.goto(link)
    added += await clickMatches(browser, "add to cart|add to bag|add product|buy now")
  }
  return added
}

async function clickMatches(browser: BrowserRun, pattern: string) {
  const clicked = await browser.page.evaluate<number>(`(() => {
    const pattern = ${JSON.stringify(pattern)}
    const nodes = [...document.querySelectorAll("a,button,[role=button],input[type=submit]")]
    let count = 0
    const seen = new Set()
    for (const node of nodes) {
      const label = (node.innerText || node.value || "").replace(/\\s+/g, " ").trim()
      if (!label || seen.has(label) || !new RegExp(pattern, "i").test(label)) continue
      seen.add(label)
      node.click()
      count += 1
      if (count >= 2) break
    }
    return count
  })()`)
  if (clicked) await sleep(1200)
  return clicked
}

async function openCart(browser: BrowserRun) {
  const opened = await browser.page.evaluate<boolean>(`(() => {
    const node = [...document.querySelectorAll("a,button")].find((item) => /view cart|^cart$|bag/i.test((item.innerText || "").trim()) || /\\/cart\\b/i.test(item.href || ""))
    if (!node) return false
    node.click()
    return true
  })()`)
  if (opened) {
    await sleep(1500)
    return true
  }
  const cartUrl = new URL("/cart", await browser.page.evaluate<string>("location.href"))
  await browser.goto(cartUrl.toString()).catch(() => undefined)
  const text = await browser.page.evaluate<string>("document.body.innerText.slice(0, 500)")
  return /cart|bag|subtotal|checkout/i.test(text)
}

async function openCheckout(browser: BrowserRun) {
  const opened = await browser.page.evaluate<boolean>(`(() => {
    const node = [...document.querySelectorAll("a,button,[role=button]")].find((item) => /checkout|continue to payment/i.test(item.innerText || ""))
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!opened) return false
  await sleep(1500)
  return true
}

async function detectStripe(browser: BrowserRun) {
  const mode = await browser.page.evaluate<string>(`(() => {
    const text = document.documentElement.innerHTML
    if (text.includes("pk_live_")) return "live"
    if (text.includes("pk_test_")) return "test"
    return "unknown"
  })()`)
  if (mode === "live" || mode === "test") return mode
  return "unknown"
}

async function fillCheckout(browser: BrowserRun, buyer: Buyer) {
  const filled = await browser.page.evaluate<number>(`(() => {
    const buyer = ${JSON.stringify(buyer)}
    const fields = [...document.querySelectorAll("input,textarea,select")]
    let count = 0
    const write = (field, value) => {
      if (!value || field.disabled) return
      const proto = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set
      setter?.call(field, value)
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.dispatchEvent(new Event("change", { bubbles: true }))
      count += 1
    }
    for (const field of fields) {
      const key = [field.name, field.id, field.placeholder, field.getAttribute("aria-label"), field.type].join(" ").toLowerCase()
      if (/first/.test(key)) write(field, buyer.first)
      else if (/last/.test(key)) write(field, buyer.last)
      else if (/email/.test(key)) write(field, buyer.email)
      else if (/phone|tel/.test(key)) write(field, buyer.phone)
      else if (/address|street/.test(key) && !/email/.test(key)) write(field, buyer.address)
      else if (/city/.test(key)) write(field, buyer.city)
      else if (/state|region/.test(key)) write(field, buyer.state)
      else if (/zip|postal/.test(key)) write(field, buyer.zip)
    }
    return count
  })()`)
  return filled
}

async function applyCoupon(browser: BrowserRun) {
  const applied = await browser.page.evaluate<boolean>(`(() => {
    const field = [...document.querySelectorAll("input")].find((input) => /coupon|promo|discount|voucher/i.test([input.name, input.id, input.placeholder, input.getAttribute("aria-label")].join(" ")))
    if (!field) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    setter?.call(field, ${JSON.stringify(COUPON)})
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.dispatchEvent(new Event("change", { bubbles: true }))
    const button = [...document.querySelectorAll("button,[role=button]")].find((item) => /apply|redeem/i.test(item.innerText || ""))
    button?.click()
    return true
  })()`)
  if (applied) await sleep(800)
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
    const node = [...document.querySelectorAll("button,[role=button],input[type=submit]")].find((item) => /place order|pay now|complete order|submit order/i.test((item.innerText || item.value || "")))
    if (!node) return false
    node.click()
    return true
  })()`)
  if (!clicked) return { orderId: "", detail: "The place-order button was not found." }
  await sleep(4000)
  const found = await browser.page.evaluate<{ orderId: string; detail: string }>(`(() => {
    const text = document.body.innerText || ""
    const match = text.match(/order\\s*(?:id|number|#)?\\s*[:#]?\\s*([A-Z0-9-]{5,})/i)
    return { orderId: match ? match[1] : "", detail: text.slice(0, 240) }
  })()`)
  return { orderId: found.orderId, detail: found.orderId ? found.detail : "The order id was not on the confirmation page." }
}

async function legalChecks(browser: BrowserRun) {
  const links = await browser.page.evaluate<{ id: string; name: string; href: string }[]>(`() => {
    const wanted = [
      ["privacy", "Privacy policy", /privacy/i],
      ["terms", "Terms", /terms|conditions/i],
      ["refund", "Refund policy", /refund|return/i],
      ["hipaa", "HIPAA notice", /hipaa/i],
    ]
    const anchors = [...document.querySelectorAll("a")]
    return wanted.map(([id, name, pattern]) => {
      const found = anchors.find((anchor) => pattern.test(anchor.innerText || "") || pattern.test(anchor.href || ""))
      return { id, name, href: found?.href || "" }
    })
  }`)
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
