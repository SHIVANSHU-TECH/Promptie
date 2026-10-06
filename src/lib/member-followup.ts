import type { BrowserRun } from "./browser-session"
import type { FlowCheck } from "./flow-report"

type Inbox = { address: string; token: string }

export type MailMessage = { subject: string; text: string }

export type MemberResult = {
  email: string
  password: string
  checks: FlowCheck[]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function check(id: string, name: string, ok: boolean, detail: string): FlowCheck {
  return { id, name, status: ok ? "pass" : "fail", detail }
}

function htmlText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim()
}

export async function openTempInbox(): Promise<Inbox> {
  const domains = await fetch("https://api.mail.tm/domains", { cache: "no-store" }).then((response) => response.json())
  const domain = domains?.["hydra:member"]?.[0]?.domain
  if (!domain) throw new Error("A temporary inbox could not be opened.")
  const address = `promptie${Math.random().toString(36).slice(2, 8)}@${domain}`
  const password = `Promptie${Math.random().toString(36).slice(2, 10)}`
  const created = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  })
  if (!created.ok) throw new Error("A temporary inbox could not be opened.")
  const tokenBody = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  }).then((response) => response.json())
  if (!tokenBody?.token) throw new Error("A temporary inbox could not be opened.")
  return { address, token: tokenBody.token }
}

export async function waitForMail(token: string) {
  const started = Date.now()
  let messages: MailMessage[] = []
  while (Date.now() - started < 50000) {
    const data = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((response) => response.json())
      .catch(() => null)
    const list = Array.isArray(data?.["hydra:member"]) ? data["hydra:member"] : []
    if (list.length) {
      const next: MailMessage[] = []
      for (const item of list) {
        const full = await fetch(`https://api.mail.tm/messages/${item.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
          .then((response) => response.json())
          .catch(() => null)
        if (!full) continue
        const html = Array.isArray(full.html) ? full.html.join("\n") : full.html || ""
        next.push({ subject: String(full.subject || item.subject || ""), text: full.text || htmlText(html) })
      }
      messages = next
      const orders = messages.some((item) => /order confirmation/i.test(item.subject))
      const welcome = messages.some((item) => /username\s*:/i.test(item.text) && /password\s*:/i.test(item.text))
      if (orders && welcome) return messages
    }
    await sleep(3000)
  }
  return messages
}

function memberHost(storeUrl: string) {
  const host = new URL(storeUrl).hostname.replace(/^www\./, "")
  return `https://member.${host}/login`
}

async function waitFor(browser: BrowserRun, expression: string, ms = 15000) {
  const started = Date.now()
  while (Date.now() - started < ms) {
    const ready = await browser.page.evaluate<boolean>(expression).catch(() => false)
    if (ready) return true
    await sleep(400)
  }
  return false
}

function writeLogin(email: string, password: string) {
  return `(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    const write = (field, value) => {
      if (!field) return false
      setter?.call(field, value)
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }
    const emailField = [...document.querySelectorAll("input")].find((input) => /email/i.test([input.type, input.placeholder, input.getAttribute("aria-label")].join(" ")))
    const passwordField = [...document.querySelectorAll("input")].find((input) => input.type === "password" || /password/i.test(input.placeholder || ""))
    return write(emailField, ${JSON.stringify(email)}) && write(passwordField, ${JSON.stringify(password)})
  })()`
}

function writePasswords(password: string) {
  return `(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    const fields = [...document.querySelectorAll("input")].filter((input) => input.type === "password" || /password/i.test(input.placeholder || ""))
    if (fields.length < 2) return false
    for (const field of fields) {
      setter?.call(field, ${JSON.stringify(password)})
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.dispatchEvent(new Event("change", { bubbles: true }))
    }
    return true
  })()`
}

export async function finishMemberPortal(
  browser: BrowserRun,
  storeUrl: string,
  email: string,
  messages: MailMessage[],
  onStep?: (label: string) => Promise<void>,
): Promise<MemberResult> {
  const checks: FlowCheck[] = []
  const orders = messages.filter((item) => /order confirmation/i.test(item.subject))
  const orderIds = [
    ...new Set(
      orders
        .map((item) => item.subject.match(/#\s*(\d{3,})/)?.[1] || item.text.match(/order number:\s*(\d{3,})/i)?.[1] || "")
        .filter(Boolean),
    ),
  ]
  const welcome = messages.find((item) => /username\s*:/i.test(item.text) && /password\s*:/i.test(item.text))
  const mailedPassword = welcome?.text.match(/password\s*:\s*(\S+)/i)?.[1] || ""
  const loginUrl = welcome?.text.match(/login url\s*:\s*(\S+)/i)?.[1] || memberHost(storeUrl)
  checks.push(
    check(
      "order-mail",
      "Order confirmation mail",
      orders.length > 0,
      orders.length ? `Received ${orders.length} order mail${orders.length === 1 ? "" : "s"}: ${orderIds.join(", ") || "order numbers not parsed"}.` : "No order confirmation arrived in the temporary inbox.",
    ),
  )
  checks.push(
    check(
      "member-mail",
      "Member id and password mail",
      Boolean(mailedPassword),
      mailedPassword ? `Welcome mail included the member id ${email} and a login password.` : "The welcome mail with a member id and password did not arrive.",
    ),
  )
  if (!mailedPassword) {
    checks.push(check("member-login", "Member login", false, "Member login needs a completed order. The welcome mail did not arrive."))
    checks.push(check("password-reset", "Set a new password", false, "The password page never opened."))
    checks.push(check("orders-visible", "Orders on the member portal", false, "The portal was not opened."))
    checks.push(check("intake", "Medical intake", false, "No intake was available because the portal was not opened."))
    return { email, password: "", checks }
  }

  await onStep?.("Opening the member portal")
  await browser.goto(loginUrl).catch(() => undefined)
  const loginReady = await waitFor(
    browser,
    `(() => [...document.querySelectorAll("input")].some((input) => /email/i.test([input.type, input.placeholder].join(" "))))()`,
  )
  if (!loginReady) await browser.goto(memberHost(storeUrl)).catch(() => undefined)
  await waitFor(browser, `(() => [...document.querySelectorAll("input")].some((input) => /email/i.test([input.type, input.placeholder].join(" "))))()`)
  const signed = await browser.page.evaluate<boolean>(writeLogin(email, mailedPassword))
  if (signed) {
    await browser.page.evaluate(`(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /^sign in$/i.test((item.innerText || "").trim()))
      button?.click()
    })()`)
  }
  const changed = await waitFor(browser, `(() => /change-password/i.test(location.pathname) || /set a new password/i.test(document.body.innerText || ""))()`, 20000)
  checks.push(
    check(
      "member-login",
      "Member login",
      signed && changed,
      signed && changed ? "Signed in with the password from the welcome mail." : "The member portal did not accept the mailed id and password.",
    ),
  )

  const chosen = `Promptie${Math.random().toString(36).slice(2, 8)}7!`
  let passwordSet = false
  if (changed) {
    await onStep?.("Setting a new password")
    passwordSet = await browser.page.evaluate<boolean>(writePasswords(chosen))
    if (passwordSet) {
      await browser.page.evaluate(`(() => {
        const button = [...document.querySelectorAll("button")].find((item) => /update password/i.test(item.innerText || ""))
        button?.click()
      })()`)
      await waitFor(browser, `(() => /\\/login\\/?$/i.test(location.pathname))()`, 15000)
      await browser.page.evaluate<boolean>(writeLogin(email, chosen))
      await browser.page.evaluate(`(() => {
        const button = [...document.querySelectorAll("button")].find((item) => /^sign in$/i.test((item.innerText || "").trim()))
        button?.click()
      })()`)
    }
  }
  const portal = await waitFor(
    browser,
    `(() => /dashboard|your products|complete medical intake|action required/i.test(document.body.innerText || ""))()`,
    20000,
  )
  checks.push(
    check(
      "password-reset",
      "Set a new password",
      passwordSet && portal,
      passwordSet ? `New password set to ${chosen}.` : "The portal did not ask for a new password.",
    ),
  )

  const portalText = portal ? await browser.page.evaluate<string>(`(document.body.innerText || "").slice(0, 4000)`) : ""
  const shown = orderIds.filter((id) => portalText.includes(id))
  checks.push(
    check(
      "orders-visible",
      "Orders on the member portal",
      portal && shown.length > 0,
      portal && shown.length ? `The portal lists ${shown.join(", ")}.` : "The purchased orders were not on the member portal.",
    ),
  )

  const offered = portal ? await intakeButtons(browser) : []
  checks.push(
    check(
      "intake-present",
      "Intake received",
      offered.length > 0,
      offered.length ? `The portal has an intake for ${offered.map((item) => item.label).join("; ")}.` : "No medical intake was offered for these orders.",
    ),
  )
  const submitted = offered.length ? await submitEveryIntake(browser, email, onStep) : []
  for (const item of submitted) {
    checks.push(
      check(
        `intake-${item.orderId || item.label}`,
        `Intake for ${item.label}`,
        item.ok,
        item.ok ? `Submitted the intake for ${item.label}.` : `The intake for ${item.label} did not submit.`,
      ),
    )
  }
  const portalAfter = submitted.length ? await browser.page.evaluate<string>(`(document.body.innerText || "").slice(0, 4000)`).catch(() => "") : ""
  const stillOpen = /complete medical intake/i.test(portalAfter)
  const backOnPortal = /your products|you're all set|form completed|action required/i.test(portalAfter)
  const allDone = submitted.length > 0 && submitted.every((item) => item.ok) && backOnPortal && !stillOpen
  checks.push(
    check(
      "intake-submitted",
      "Every product intake submitted",
      allDone,
      allDone
        ? `Submitted ${submitted.length} intake${submitted.length === 1 ? "" : "s"}. The portal has no remaining medical intake.`
        : offered.length
          ? `Submitted ${submitted.filter((item) => item.ok).length} of ${submitted.length || offered.length} product intakes.`
          : "There was no intake to submit.",
    ),
  )
  return { email, password: passwordSet ? chosen : "", checks }
}

async function intakeButtons(browser: BrowserRun) {
  return browser.page.evaluate<{ orderId: string; label: string }[]>(`(() => {
    const text = (node) => (node.innerText || "").replace(/\\s+/g, " ").trim()
    return [...document.querySelectorAll("button")]
      .filter((button) => /complete medical intake/i.test(text(button)))
      .map((button) => {
        let node = button.parentElement
        let card = ""
        while (node && node !== document.body) {
          const sample = text(node)
          if (/order\\s*#\\s*\\d{3,}/i.test(sample) && sample.length < 700) {
            card = sample
            break
          }
          node = node.parentElement
        }
        const orderId = card.match(/order\\s*#\\s*(\\d{3,})/i)?.[1] || ""
        const label = (card.split(/order\\s*#/i)[0] || "Product").replace(/complete medical intake/i, "").trim().slice(0, 80) || orderId || "Product"
        return { orderId, label }
      })
  })()`)
}

async function submitEveryIntake(
  browser: BrowserRun,
  email: string,
  onStep?: (label: string) => Promise<void>,
) {
  const results: { orderId: string; label: string; ok: boolean }[] = []
  const home = await browser.page.evaluate<string>(`location.origin + "/dashboard"`)
  for (let index = 0; index < 6; index += 1) {
    const pending = await intakeButtons(browser)
    const next = pending[0]
    if (!next) break
    await onStep?.(`Opening the intake for ${next.label}`)
    await browser.page.evaluate(`(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /complete medical intake/i.test(item.innerText || ""))
      button?.click()
    })()`)
    const frame = await waitFor(
      browser,
      `(() => [...document.querySelectorAll("iframe")].some((frame) => /forms\\.whitelabelmd\\.com/i.test(frame.src || "")))()`,
      15000,
    )
    const src = frame
      ? await browser.page.evaluate<string>(
          `([...document.querySelectorAll("iframe")].find((frame) => /forms\\.whitelabelmd\\.com/i.test(frame.src || ""))?.src || "")`,
        )
      : ""
    const orderId = src.match(/order_id=(\\d+)/)?.[1] || next.orderId
    let ok = false
    if (src) {
      await browser.goto(src).catch(() => undefined)
      ok = await walkIntake(browser, email)
    }
    const existing = results.find((item) => item.orderId && item.orderId === orderId)
    if (existing) existing.ok = existing.ok || ok
    else results.push({ orderId, label: next.label, ok })
    await browser.goto(home).catch(() => undefined)
    await waitFor(
      browser,
      `(() => /complete medical intake|your products|action required/i.test(document.body.innerText || ""))()`,
      15000,
    )
  }
  return results
}

async function walkIntake(browser: BrowserRun, email: string) {
  await waitFor(browser, `(() => /start|next|submit|form-pagebreak-next/i.test(document.body.innerHTML || ""))()`, 12000)
  let submitted = false
  let previous = ""
  let repeats = 0
  for (let step = 0; step < 40; step += 1) {
    const action = await browser.page.evaluate<string>(`(() => {
      const text = (node) => (node.innerText || node.value || "").replace(/\\s+/g, " ").trim()
      if (/submission has been received|successfully submitted/i.test(document.body.innerText || "")) return "done"
      const page = [...document.querySelectorAll(".form-section.page-section")].find((section) => getComputedStyle(section).display !== "none")
      if (!page) return "stuck|"
      const question = text(page)
      const offersLast4 = /last 4|social security/i.test(question)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      const areaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
      let attached = false
      for (const field of page.querySelectorAll("input, textarea, select")) {
        if (field.type === "file") {
          if (offersLast4 || (field.files && field.files.length)) continue
          const canvas = document.createElement("canvas")
          canvas.width = 240
          canvas.height = 420
          const ctx = canvas.getContext("2d")
          ctx.fillStyle = "#d9d3c7"
          ctx.fillRect(0, 0, 240, 420)
          ctx.fillStyle = "#8a8175"
          ctx.fillRect(70, 40, 100, 120)
          ctx.fillRect(90, 160, 60, 220)
          const data = canvas.toDataURL("image/jpeg", 0.8)
          const binary = atob(data.split(",")[1])
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
          const upload = new DataTransfer()
          upload.items.add(new File([bytes], "intake-photo.jpg", { type: "image/jpeg" }))
          field.files = upload.files
          field.dispatchEvent(new Event("input", { bubbles: true }))
          field.dispatchEvent(new Event("change", { bubbles: true }))
          attached = true
          continue
        }
        if (field.type === "radio" || field.type === "checkbox") continue
        const hint = [field.placeholder, field.name, field.id, field.getAttribute("aria-label")].join(" ")
        if (/ssn|social/i.test(hint)) {
          setter?.call(field, "0000")
          field.dispatchEvent(new Event("input", { bubbles: true }))
          field.dispatchEvent(new Event("change", { bubbles: true }))
          continue
        }
        if (field.type === "hidden") continue
        if (field.tagName === "SELECT") {
          if (/year/i.test(hint)) {
            const year = [...field.options].find((item) => item.value === "1990")
            if (year && field.value !== "1990") {
              field.value = "1990"
              field.dispatchEvent(new Event("change", { bubbles: true }))
            }
            continue
          }
          if (/month/i.test(hint) && !field.value) {
            const month = [...field.options].find((item) => item.value === "1")
            if (month) {
              field.value = month.value
              field.dispatchEvent(new Event("change", { bubbles: true }))
            }
            continue
          }
          if (/day/i.test(hint) && !field.value) {
            const day = [...field.options].find((item) => item.value === "15")
            if (day) {
              field.value = day.value
              field.dispatchEvent(new Event("change", { bubbles: true }))
            }
            continue
          }
          if (/state/i.test(hint)) {
            const texas = [...field.options].find((item) => /texas/i.test(item.text + " " + item.value))
            if (texas) {
              field.value = texas.value
              field.dispatchEvent(new Event("change", { bubbles: true }))
              continue
            }
          }
          if (field.value) continue
          const option = [...field.options].find((item) => item.value && !/please select|^month$|^day$|^year$/i.test(item.text))
          if (option) {
            field.value = option.value
            field.dispatchEvent(new Event("change", { bubbles: true }))
          }
          continue
        }
        if (field.getBoundingClientRect().width < 2) continue
        const current = (field.value || "").trim()
        if (current.length >= 10) continue
        const line = text(field.closest("li") || field.parentElement || field) + " " + hint
        let value = field.tagName === "TEXTAREA" || /message|comment|detail|explain/i.test(line) ? "No additional details for this visit." : "None"
        if (/email/i.test(line)) value = ${JSON.stringify(email)}
        else if (/phone|mobile/i.test(line)) value = "(202) 555-0148"
        else if (/postal|zip/i.test(line)) value = "78701"
        else if (/city/i.test(line)) value = "Austin"
        else if (/addr_line1|street|address/i.test(line)) value = "120 Market Street"
        else if (/weight/i.test(line)) value = "180"
        else if (/inch/i.test(line)) value = "10"
        else if (/height|feet/i.test(line)) value = "5"
        else if (/first/i.test(line)) value = "Quinn"
        else if (/\\blast\\b/i.test(line)) value = "Hale"
        if (current === value) continue
        const write = field.tagName === "TEXTAREA" ? areaSetter : setter
        write?.call(field, value)
        field.dispatchEvent(new Event("input", { bubbles: true }))
        field.dispatchEvent(new Event("change", { bubbles: true }))
      }
      const groups = new Map()
      for (const choice of page.querySelectorAll("input[type=radio], input[type=checkbox]")) {
        const key = choice.name || choice.id
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(choice)
      }
      for (const group of groups.values()) {
        if (group.some((item) => item.checked)) continue
        const labelOf = (item) => text(item.closest("label") || item.parentElement || item)
        const wantsYes = /understand all the questions|are you here|evaluated for/i.test(question)
        const male = /gender/i.test(question) ? group.find((item) => /male/i.test(labelOf(item) + item.value) && !/female/i.test(labelOf(item) + item.value)) : null
        const preferred = male || (wantsYes
          ? group.find((item) => /^yes\\b/i.test(item.value) || /^yes\\b/i.test(labelOf(item)))
          : group.find((item) => /none of these|\\bnone\\b|^no\\b/i.test(labelOf(item)) || /^no\\b/i.test(item.value)))
        const last4 = group.find((item) => /last 4|social security/i.test(labelOf(item) + item.value))
        const pick = preferred || last4 || group[0]
        ;(pick.closest("label") || pick).click()
      }
      if (attached) return "upload|" + question.slice(0, 80)
      const start = [...page.querySelectorAll("button")].find((button) => /^start$/i.test(text(button)))
      if (start) {
        start.click()
        return "start|" + question.slice(0, 80)
      }
      const button = [...page.querySelectorAll("button")].find((item) => (item.className.includes("form-pagebreak-next") || item.className.includes("form-submit-button")) && !item.className.includes("button-hidden"))
      if (!button) return "stuck|" + question.slice(0, 80)
      const name = /submit/i.test(button.className + text(button)) ? "submit" : "next"
      button.click()
      return name + "|" + question.slice(0, 80)
    })()`)
    const [kind, heading] = action.split("|")
    if (kind === "done") {
      submitted = true
      break
    }
    if (kind === "submit") {
      submitted = await waitFor(
        browser,
        `(() => /submission has been received|successfully submitted/i.test(document.body.innerText || ""))()`,
        10000,
      )
      break
    }
    if (kind === "stuck") break
    if (heading && heading === previous) repeats += 1
    else repeats = 0
    previous = heading || previous
    if (repeats >= 4) break
    await sleep(kind === "upload" ? 1600 : 700)
  }
  return submitted
}
