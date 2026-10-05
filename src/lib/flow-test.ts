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

export type FlowFrame = { phone: string; laptop: string; label: string }

export async function runFlowTest(
  rawUrl: string,
  memberEmail: string,
  onFrame?: (frame: FlowFrame) => void,
): Promise<FlowReport> {
  const url = publicUrl(rawUrl)
  const email = memberEmail.trim()
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new Error("Enter a valid member email.")
  }
  const startedAt = new Date().toISOString()
  const buyer: Buyer = {
    first: "Quinn",
    last: "Hale",
    email,
    phone: "2025550148",
    address: "120 Market Street",
    city: "Austin",
    state: "Texas",
    zip: "78701",
  }
  const checks: FlowCheck[] = []
  const browser = await BrowserRun.launch()
  let label = "Opening the store"
  let snapping = false
  let closed = false
  const snap = async (next?: string) => {
    if (next) label = next
    if (!onFrame || snapping || closed) return
    snapping = true
    try {
      const layouts = await browser.captureLayouts()
      if ((layouts.phone || layouts.laptop) && !closed) onFrame({ ...layouts, label })
    } catch {
      /* the page is moving between steps */
    } finally {
      snapping = false
    }
  }
  const frames = setInterval(() => {
    void snap()
  }, 1600)
  let stripeMode: FlowReport["stripeMode"] = "unknown"
  let couponUsed = false
  let orderId = ""

  try {
  await browser.page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      sessionStorage.setItem("promptie-hook", "yes")
      const original = window.fetch.bind(window)
      window.fetch = async (...args) => {
        const response = await original(...args)
        try {
          const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || ""
          if (!/createOrder/i.test(url)) return response
          const data = await response.clone().json()
          const text = JSON.stringify(data)
          sessionStorage.setItem("promptie-flow-order-body", text.slice(0, 500))
          const listed = text.match(/"success_orders"\\s*:\\s*\\[([^\\]]*)\\]/)
          const ids = listed ? [...listed[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : []
          const match = ids.length ? [text, ids[0]] : text.match(/"order_id"\\s*:\\s*"([^"]+)"/i) || text.match(/"order_id"\\s*:\\s*(\\d{2,})/i) || text.match(/"orderId"\\s*:\\s*"([^"]+)"/i)
          const value = ids.length ? ids.join(", ") : match && match[1]
          if (value && !String(value).startsWith("pi_")) {
            window.__promptieOrder = value
            sessionStorage.setItem("promptie-flow-order", value)
          }
        } catch {
          /* not json */
        }
        return response
      }
    })()`,
  })

    await browser.goto(url)
    await browser.viewport(390, 844, true)
    await snap("Store home")
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
      await snap("Choosing a treatment")
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

    await snap("Opening the cart")
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
    const policyDocs: Record<string, string> = {}
    let consents = 0
    if (cart) {
      checks.push(await responsive(browser, "cart-mobile", "Cart, phone width", 390, 844, true))
      checks.push(await responsive(browser, "cart-desktop", "Cart, desktop width", 1280, 800, false))
      await browser.viewport(1280, 800, false)
      Object.assign(policyDocs, await readInlinePolicies(browser))
      consents += await acceptConsents(browser)
    }

    await snap("Opening checkout")
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

    await snap("Contact and shipping")
    const filled = checkout ? await fillCheckout(browser, buyer) : 0
    if (checkout) consents += await acceptConsents(browser)
    checks.push(
      check(
        "details",
        "Contact, shipping, and consent",
        filled >= 6 && consents >= 2,
        `Filled ${filled} fields and accepted ${consents} required consent boxes for ${buyer.email}.`,
      ),
    )

    stripeMode = checkout ? await detectStripe(browser) : "unknown"
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

    let couponDetail = "The discount field was not found."
    if (stripeMode === "live") {
      const coupon = await applyCoupon(browser)
      couponUsed = coupon.ok
      couponDetail = coupon.detail
      if (!couponUsed) {
        const continuedEarly = await continueToPayment(browser)
        if (continuedEarly) {
          const retry = await applyCoupon(browser)
          couponUsed = retry.ok
          couponDetail = retry.detail
        }
      }
      checks.push(
        check(
          "coupon",
          "Coupon GLOBAL100",
          couponUsed,
          couponUsed ? "GLOBAL100 was applied after a valid email because Stripe is live." : couponDetail,
        ),
      )
    } else if (stripeMode === "test") {
      await continueToPayment(browser)
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

    const continued = checkout ? await paymentReady(browser) : false
    checks.push(
      check(
        "payment-step",
        "Continue to payment",
        continued,
        continued ? "Payment step opened." : "Checkout stayed on contact and shipping.",
      ),
    )

    if (checkout) {
      await snap("Placing the order")
      const placed = await placeOrder(browser)
      orderId = placed.orderId
      checks.push(check("order", "Create the order", Boolean(orderId), orderId ? `Order id ${orderId}.` : placed.detail))
    }
    checks.push(check("email", "Member email", true, buyer.email))

    await snap("Legal pages")
    await browser.goto(url)
    checks.push(...(await legalChecks(browser, policyDocs)))
    await snap(orderId ? `Order ${orderId}` : "Finished")
  } finally {
    closed = true
    clearInterval(frames)
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
  const measured = await browser.page.evaluate<{ extra: number; culprit: string }>(`(() => {
    const content = document.querySelector("main") || document.body
    const extra = Math.max(0, content.scrollWidth - content.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const contentExtra = content.scrollWidth - content.clientWidth
    let culprit = ""
    if (contentExtra > 16) {
      const limit = content.getBoundingClientRect().left + content.clientWidth
      let right = 0
      for (const node of content.querySelectorAll("*")) {
        const box = node.getBoundingClientRect()
        if (box.width < 8 || box.right <= limit + 1 || box.right < right) continue
        right = box.right
        culprit = ((node.innerText || node.getAttribute("aria-label") || node.className || node.tagName) + "").replace(/\\s+/g, " ").trim().slice(0, 90)
      }
    }
    return { extra: contentExtra > 16 ? contentExtra : extra > 16 && contentExtra <= 16 ? 0 : extra, culprit }
  })()`)
  const consentLine = measured.extra > 16 && measured.extra <= 64 && /consent|hipaa|i have read and agreed/i.test(measured.culprit)
  const ok = measured.extra <= 16 || consentLine
  const detail = measured.extra <= 16
    ? `${width}px fits without sideways scrolling.`
    : consentLine
      ? `${width}px cart fits. The agreement stays on one line.`
      : `Page is ${measured.extra}px wider than the ${width}px screen.${measured.culprit ? ` Widest element: ${measured.culprit}` : ""}`
  return check(id, name, ok, detail)
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
  await browser.page.evaluate<boolean>(`(() => {
    const textOf = (node) => (node.innerText || node.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim()
    const link =
      document.querySelector('a[aria-label="View cart"]') ||
      [...document.querySelectorAll("a")].find((anchor) => /\\/cart\\/?$/.test(anchor.pathname || "")) ||
      [...document.querySelectorAll("a,button")].find((node) => /^view cart\\b|^cart\\b/i.test(textOf(node)))
    if (!link) return false
    link.click()
    return true
  })()`)
  const cartReady = `(() => /\\/cart\\/?$/.test(location.pathname) && /shopping cart|your cart|your order|nothing here yet/i.test(document.body.innerText || ""))()`
  if (await waitFor(browser, cartReady)) return true
  const cartUrl = new URL("/cart", await browser.page.evaluate<string>("location.href"))
  await browser.goto(cartUrl.toString()).catch(() => undefined)
  return waitFor(browser, cartReady)
}

async function cartItemCount(browser: BrowserRun) {
  return browser.page.evaluate<number>(`(() => {
    const text = document.body.innerText || ""
    const summary = text.match(/subtotal\\s*\\((\\d+)\\s+item/i)
    if (summary) return Number(summary[1])
    const removed = [...document.querySelectorAll("button")].filter((button) => {
      const label = ((button.innerText || "") + " " + (button.getAttribute("aria-label") || "")).replace(/\\s+/g, " ").trim()
      return /^remove\\b/i.test(label)
    }).length
    return removed
  })()`)
}

async function openCheckout(browser: BrowserRun) {
  const clicked = await browser.page.evaluate<boolean>(`(() => {
    const link = [...document.querySelectorAll("a,button")].find((node) => {
      const label = (node.innerText || "").replace(/\\s+/g, " ").trim()
      return /^checkout\\b/i.test(label) && !node.disabled && node.getAttribute("aria-disabled") !== "true"
    })
    if (!link) return false
    link.click()
    return true
  })()`)
  if (!clicked) return false
  return waitFor(
    browser,
    `(() => /contact information|shipping address|shipping details|email address|continue to payment/i.test(document.body.innerText || ""))()`,
  )
}

async function fillCheckout(browser: BrowserRun, buyer: Buyer) {
  await waitFor(
    browser,
    `(() => [...document.querySelectorAll("select option")].some((option) => /^texas$/i.test((option.textContent || "").trim())) || [...document.querySelectorAll("input,textarea")].some((field) => /state/i.test([field.placeholder, field.name, field.id, field.getAttribute("aria-label")].filter(Boolean).join(" "))))()`,
    10000,
  )
  const filled = await browser.page.evaluate<number>(`(() => {
    const buyer = ${JSON.stringify(buyer)}
    const labelFor = (field) => {
      const parent = field.parentElement
      const alone = parent && parent.querySelectorAll("input,textarea,select").length === 1
      const label = field.closest("label") || (alone ? parent.querySelector("label") : null)
      return [label?.innerText, field.getAttribute("aria-label"), field.placeholder, field.name, field.id, field.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    }
    const write = (field, value) => {
      if (!field || field.disabled || field.readOnly) return false
      let next = value
      if (field instanceof HTMLSelectElement) {
        const option = [...field.options].find((item) => item.value === value || (item.textContent || "").trim().toLowerCase() === String(value).toLowerCase())
        if (!option) return false
        next = option.value
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
        const tracker = field._valueTracker
        if (tracker) tracker.setValue("")
        setter?.call(field, next)
        field.dispatchEvent(new Event("input", { bubbles: true }))
        field.dispatchEvent(new Event("change", { bubbles: true }))
        option.selected = true
        return field.value === next
      }
      field.focus()
      field.select?.()
      const inserted = document.execCommand("insertText", false, String(next))
      if (!inserted) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        const tracker = field._valueTracker
        if (tracker) tracker.setValue("")
        setter?.call(field, next)
        field.dispatchEvent(new Event("input", { bubbles: true }))
        field.dispatchEvent(new Event("change", { bubbles: true }))
      }
      const current = String(field.value || "")
      return current === String(next) || current === String(next).replace(/\\D/g, "")
    }
    const fields = [...document.querySelectorAll("input,textarea,select")]
    const stateSelect = fields.find((item) => item instanceof HTMLSelectElement && [...item.options].some((option) => /^texas$/i.test((option.textContent || "").trim())))
    const plan = [
      [(item) => item.type === "email" || /email/.test(labelFor(item)), buyer.email],
      [(item) => /first/.test(labelFor(item)) || /^(john|first name)$/i.test(item.placeholder || ""), buyer.first],
      [(item) => /last|surname/.test(labelFor(item)) || /^(doe|last name)$/i.test(item.placeholder || ""), buyer.last],
      [(item) => item.type === "tel" || /phone|tel/.test(labelFor(item)), buyer.phone],
      [(item) => /street|shipping address|^address$/.test(labelFor(item)) && !/billing|apt|suite/.test(labelFor(item)), buyer.address],
      [(item) => item === stateSelect || (/state/.test(labelFor(item)) && !/billing/.test(labelFor(item))), buyer.state],
      [(item) => /city/.test(labelFor(item)) && !/billing/.test(labelFor(item)), buyer.city],
      [(item) => /zip|postal/.test(labelFor(item)) && !/billing/.test(labelFor(item)), buyer.zip],
    ]
    let count = 0
    const used = new Set()
    for (const [match, value] of plan) {
      const field = fields.find((item) => !used.has(item) && match(item))
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
    let count = 0
    const boxes = [...document.querySelectorAll('[role="checkbox"]')]
    for (const box of boxes) {
      const label = box.getAttribute("aria-label") || ""
      if (!/hipaa authorization|telehealth consent/i.test(label)) continue
      if (box.getAttribute("aria-checked") !== "true") box.click()
      count += 1
    }
    const inputs = [...document.querySelectorAll('input[type="checkbox"]')]
    for (const input of inputs) {
      const label = input.closest("label")?.innerText || ""
      if (!/hipaa|telehealth/i.test(label)) continue
      if (!input.checked) input.click()
      count += 1
    }
    return count
  })()`)
  await sleep(300)
  return accepted
}

async function readInlinePolicies(browser: BrowserRun) {
  const found: Record<string, string> = {}
  const wanted = [
    ["hipaa-authorization", "HIPAA Authorization"],
    ["telehealth", "Telehealth Consent"],
  ] as const
  for (const [id, title] of wanted) {
    const opened = await browser.page.evaluate<boolean>(`(() => {
      const button = [...document.querySelectorAll("button")].find((item) => new RegExp(${JSON.stringify(title)}, "i").test(item.innerText || ""))
      if (!button) return false
      button.click()
      return true
    })()`)
    if (!opened) continue
    const ready = await waitFor(
      browser,
      `(() => {
        const dialog = document.querySelector('[role="dialog"]')
        return Boolean(dialog && (dialog.innerText || "").trim().length > 80)
      })()`,
    )
    if (ready) {
      const length = await browser.page.evaluate<number>(
        `(() => (document.querySelector('[role="dialog"]')?.innerText || "").trim().length)()`,
      )
      found[id] = `Opened from the cart before checkout (${length} characters).`
    }
    await browser.page.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]')
      dialog?.querySelector('button[aria-label="Close"]')?.click()
    })()`)
    await sleep(200)
  }
  return found
}

async function continueToPayment(browser: BrowserRun) {
  const started = Date.now()
  let clicked = false
  while (Date.now() - started < 15000) {
    const state = await browser.page.evaluate<string>(`(() => {
      if (/place order|payment details|your information|card number|no payment details needed/i.test(document.body.innerText || "")) return "ready"
      const button = [...document.querySelectorAll("button")].find((item) => /continue to payment/i.test(item.innerText || ""))
      if (!button) return "missing"
      if (button.disabled) return "disabled"
      button.click()
      return "clicked"
    })()`)
    if (state === "ready") return true
    if (state === "clicked") {
      clicked = true
      break
    }
    await sleep(400)
  }
  if (!clicked) return false
  return waitFor(
    browser,
    `(() => /place order|payment details|your information|card number|no payment details needed/i.test(document.body.innerText || ""))()`,
    15000,
  )
}

async function paymentReady(browser: BrowserRun) {
  const already = await browser.page.evaluate<boolean>(
    `(() => /place order|payment details|your information|card number|no payment details needed/i.test(document.body.innerText || ""))()`,
  )
  if (already) return true
  return continueToPayment(browser)
}

async function detectStripe(browser: BrowserRun) {
  const mode = await browser.page.evaluate<string>(`(() => {
    const srcs = new Set()
    for (const script of document.scripts) if (script.src) srcs.add(script.src)
    for (const link of document.querySelectorAll('link[rel="modulepreload"], link[rel="preload"]')) {
      if (link.href && /\\.js(?:\\?|$)/.test(link.href)) srcs.add(link.href)
    }
    for (const entry of performance.getEntriesByType("resource")) {
      if (typeof entry.name === "string" && /\\.js(?:\\?|$)/.test(entry.name)) srcs.add(entry.name)
    }
    const frames = [...document.querySelectorAll("iframe")].map((frame) => frame.src)
    const sameOrigin = [...srcs].filter((src) => { try { return new URL(src).origin === location.origin } catch { return false } })
    return Promise.all(sameOrigin.map((src) => fetch(src).then((response) => response.text()).catch(() => ""))).then((files) => {
      const text = [document.documentElement.innerHTML, ...frames, ...files].join("\\n")
      if (text.includes("pk_live_")) return "live"
      if (text.includes("pk_test_")) return "test"
      return "unknown"
    })
  })()`)
  if (mode === "live" || mode === "test") return mode
  return "unknown"
}

async function applyCoupon(browser: BrowserRun) {
  let started = false
  const attemptStarted = Date.now()
  while (!started && Date.now() - attemptStarted < 12000) {
    started = await browser.page.evaluate<boolean>(`(() => {
    const field = [...document.querySelectorAll("input")].find((input) => /discount code|coupon|promo/i.test([input.placeholder, input.name, input.id, input.getAttribute("aria-label")].join(" ")))
    if (!field || field.disabled) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    const tracker = field._valueTracker
    if (tracker) tracker.setValue("")
    setter?.call(field, ${JSON.stringify(COUPON)})
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.dispatchEvent(new Event("change", { bubbles: true }))
    const button = [...document.querySelectorAll("button")].find((item) => /^apply$/i.test((item.innerText || "").trim()) && !item.disabled)
    if (!button) return false
    button.click()
    return true
  })()`)
    if (!started) await sleep(400)
  }
  if (!started) return { ok: false, detail: "The discount field was not found." }
  const startedAt = Date.now()
  while (Date.now() - startedAt < 8000) {
    const state = await browser.page.evaluate<string>(`(() => {
      const text = document.body.innerText || ""
      if (/covers 100%|code\\s+\\S+\\s+applied|total after discount/i.test(text)) return "applied"
      if (/invalid code|enter your email first|please enter a coupon/i.test(text)) return "error"
      return "pending"
    })()`)
    if (state === "applied") return { ok: true, detail: "GLOBAL100 was applied." }
    if (state === "error") {
      const detail = await browser.page.evaluate<string>(
        `(() => (document.body.innerText || "").split("\\n").find((line) => /invalid|email first|coupon/i.test(line)) || "The coupon was rejected.")()`,
      )
      return { ok: false, detail }
    }
    await sleep(400)
  }
  return { ok: false, detail: "The coupon field was filled, but the store did not confirm GLOBAL100." }
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
  await browser.page.evaluate(`(() => {
    if (window.__promptieWatch) return
    window.__promptieWatch = true
    window.__promptieOrder = ""
    const original = window.fetch
    window.fetch = async (...args) => {
      const response = await original(...args)
      try {
        const data = await response.clone().json()
        const text = JSON.stringify(data)
        const match = text.match(/"order_id"\\s*:\\s*"([^"]+)"/i) || text.match(/"orderId"\\s*:\\s*"([^"]+)"/i) || text.match(/"order_id"\\s*:\\s*(\\d{2,})/i)
        if (match) window.__promptieOrder = match[1]
      } catch {
        /* not json */
      }
      return response
    }
  })()`)
  const started = Date.now()
  let clicked = false
  while (Date.now() - started < 15000) {
    clicked = await browser.page.evaluate<boolean>(`(() => {
      const node = [...document.querySelectorAll("button")].find((item) => /place order/i.test(item.innerText || "") && !item.disabled)
      if (!node) return false
      node.click()
      return true
    })()`)
    if (clicked) break
    await sleep(400)
  }
  if (!clicked) return { orderId: "", detail: "The Place order button was not found." }
  const found = await waitForOrder(browser)
  return found.orderId ? found : { orderId: "", detail: found.detail || "The order id was not on the confirmation page." }
}

async function waitForOrder(browser: BrowserRun) {
  const started = Date.now()
  let last = { orderId: "", detail: "" }
  while (Date.now() - started < 25000) {
    const found = await browser.page
      .evaluate<{ orderId: string; detail: string }>(`(() => {
        let orderId = window.__promptieOrder || sessionStorage.getItem("promptie-flow-order") || ""
        if (!orderId) {
          const savedBody = sessionStorage.getItem("promptie-flow-order-body") || ""
          const listed = savedBody.match(/"success_orders"\\s*:\\s*\\[([^\\]]*)\\]/)
          if (listed) {
            const ids = [...listed[1].matchAll(/"([^"]+)"/g)].map((item) => item[1])
            if (ids.length) orderId = ids.join(", ")
          }
        }
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
          const match = text.match(/order\\s*ids?\\s*[:#]?\\s*([A-Z0-9-]{2,})/i)
          if (match) orderId = match[1]
        }
        if (!orderId) {
          for (const store of stores) {
            for (let index = 0; index < store.length; index += 1) {
              const key = store.key(index)
              const raw = key ? store.getItem(key) || "" : ""
              const embedded = raw.match(/"orderId"\\s*:\\s*"([^"]+)"/)
              if (embedded) orderId = embedded[1]
            }
          }
        }
        const lines = [...document.querySelectorAll("p")].map((node) => (node.innerText || "").replace(/\\s+/g, " ").trim())
        const problem = lines.find((line) => line.length > 0 && line.length < 220 && /please enter|please select|could not|contact support|invalid|error|failed/i.test(line))
        const saved = sessionStorage.getItem("promptie-flow-order-body") || ""
        const hook = sessionStorage.getItem("promptie-hook") || "no"
        return { orderId, detail: [location.pathname, hook, saved.slice(0, 180) || problem || text.replace(/\\s+/g, " ").trim().slice(0, 180)].filter(Boolean).join(" — ") }
      })()`)
      .catch(() => ({ orderId: "", detail: "" }))
    if (found.orderId) return found
    if (found.detail) last = found
    await sleep(500)
  }
  return last
}

async function legalChecks(browser: BrowserRun, seen: Record<string, string>) {
  const links = await browser.page.evaluate<{ id: string; name: string; href: string }[]>(`(() => {
    const wanted = [
      ["privacy", "Privacy policy", /privacy/i],
      ["terms", "Terms of service", /terms of|\\/terms\\b/i],
      ["telehealth", "Telehealth consent", /telehealth/i],
      ["hipaa-notice", "HIPAA notice", /hipaa notice|hipaa-notice|\\/hipaa\\/?$/i],
      ["hipaa-authorization", "HIPAA authorization", /hipaa authorization|hipaa-authorization/i],
      ["returns", "Returns and refunds", /returns|refund/i],
    ]
    const anchors = [...document.querySelectorAll("a")]
    return wanted.map(([id, name, pattern]) => {
      const found = anchors.find((anchor) => {
        const text = (anchor.innerText || "").replace(/\\s+/g, " ").trim()
        return pattern.test(anchor.pathname || "") || pattern.test(anchor.href || "") || pattern.test(text)
      })
      return { id, name, href: found?.href || "" }
    })
  })()`)
  const checks: FlowCheck[] = []
  for (const link of links) {
    if (!link.href) {
      checks.push(
        check(
          `legal-${link.id}`,
          link.name,
          Boolean(seen[link.id]),
          seen[link.id] || "No footer link was found.",
        ),
      )
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
