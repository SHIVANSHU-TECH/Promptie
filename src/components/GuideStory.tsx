"use client"

import { useEffect, useState } from "react"

const SCENE_MS = 5600

type Screen =
  | "home"
  | "product"
  | "cart"
  | "details"
  | "payment"
  | "thanks"
  | "inbox"
  | "portal"
  | "intake"
  | "legal"
  | "signin"
  | "company"
  | "one"
  | "merge"
  | "sheet"
  | "member"
  | "testing"

type Scene = {
  id: string
  chapter: "ShapeMeds" | "Promptie"
  time: string
  title: string
  body: string
  screen: Screen
}

const scenes: Scene[] = [
  {
    id: "home",
    chapter: "ShapeMeds",
    time: "0:00",
    title: "Open the store",
    body: "ShapeMeds is the example. The same pages show up on the other brands: a home page, treatment links, and a cart in the header. Only the name, colors, and copy change. The test checks this page at phone width and desktop width.",
    screen: "home",
  },
  {
    id: "product",
    chapter: "ShapeMeds",
    time: "0:06",
    title: "Choose a dose, then add it",
    body: "Open a treatment such as Semaglutide. Pick a dose and a supply. The button stays quiet until a dose is chosen, then it says Add to Cart. The header Get started link goes to the quiz, so the test uses Add to Cart on the product page. It adds two treatments.",
    screen: "product",
  },
  {
    id: "cart",
    chapter: "ShapeMeds",
    time: "0:12",
    title: "Review the cart",
    body: "The bag icon is View cart. The cart page is titled Shopping cart and lists both treatments. Discount codes wait until checkout. The test confirms two items, then checks the cart on a phone and on a desktop before tapping Checkout.",
    screen: "cart",
  },
  {
    id: "details",
    chapter: "ShapeMeds",
    time: "0:18",
    title: "Contact, shipping, and consent",
    body: "Checkout step 1 asks for the member email, name, phone, street, state, city, and postal code. The test types the email you provide. It then accepts HIPAA Authorization and Telehealth Consent. Continue to payment opens step 2.",
    screen: "details",
  },
  {
    id: "payment",
    chapter: "ShapeMeds",
    time: "0:24",
    title: "Pay, with the coupon rule",
    body: "The discount field sits on the order summary. GLOBAL100 is applied only when the page has a live Stripe key, and only after the email is valid. A test Stripe key skips the coupon. Place order sends the payment.",
    screen: "payment",
  },
  {
    id: "thanks",
    chapter: "ShapeMeds",
    time: "0:30",
    title: "Read the order and the email",
    body: "The thank-you page says the order is confirmed and tells the buyer to check email for member portal credentials, then sign in and complete the forms. A member login is only created when this order succeeds.",
    screen: "thanks",
  },
  {
    id: "inbox",
    chapter: "ShapeMeds",
    time: "0:36",
    title: "Read the temporary inbox",
    body: "Testing opens its own inbox and types that address at checkout. One order confirmation arrives for each product. A welcome mail arrives with the member id, a generated password, and the member login link.",
    screen: "inbox",
  },
  {
    id: "portal",
    chapter: "ShapeMeds",
    time: "0:42",
    title: "Sign in and set a password",
    body: "The test opens the member link, signs in with the mailed id and password, and lands on Change Your Password. It sets a new password, signs in again, and the report shows that password so you can check the portal yourself.",
    screen: "portal",
  },
  {
    id: "intake",
    chapter: "ShapeMeds",
    time: "0:48",
    title: "Find the orders and the intake",
    body: "The member home lists each order from checkout. Every product with Complete Medical Intake gets its own form. The test fills that form and submits it, then returns for the next product. The checklist passes only when every product intake is submitted.",
    screen: "intake",
  },
  {
    id: "legal",
    chapter: "ShapeMeds",
    time: "0:54",
    title: "Check the legal pages",
    body: "The footer is part of the flow. The test opens Privacy, Terms of Service, Telehealth Consent, HIPAA Notice, HIPAA Authorization, and Returns & Refunds, and passes each one when the page has real policy text.",
    screen: "legal",
  },
  {
    id: "signin",
    chapter: "Promptie",
    time: "1:00",
    title: "Sign in with Google",
    body: "Promptie opens with one button: Continue with Google. The header then has Board, Templates, Companies, Chat, Member, and Testing, plus the company menu. There are no sample companies to delete.",
    screen: "signin",
  },
  {
    id: "company",
    chapter: "Promptie",
    time: "1:06",
    title: "Add the brand yourself",
    body: "Open Companies and create the brand you are working on. Its name and values fill {{slots}} on the Board. Chat can still answer a site id, a chat widget, or a member JSON before any company exists.",
    screen: "company",
  },
  {
    id: "one",
    chapter: "Promptie",
    time: "1:12",
    title: "Modify one prompt for a project",
    body: "Pick the company in the header. On the Board, one template fills its {{slots}} with that company’s values. To change the wording, open Chat, leave a single prompt checked, and click Modify this prompt. Copy it for the company, or Add to library and use it on the Board.",
    screen: "one",
  },
  {
    id: "merge",
    chapter: "Promptie",
    time: "1:18",
    title: "Merge prompts, then use the result",
    body: "In Chat, check two or more prompts and click Merge selected prompts. You get one titled prompt. Add to library, open it on the Board, and copy it for the company. Brand details stay in {{slots}}.",
    screen: "merge",
  },
  {
    id: "sheet",
    chapter: "Promptie",
    time: "1:24",
    title: "Ask for a site id or chat widget",
    body: "In Chat, ask for a site id or a chat widget by brand name. The answer is read from the live checkout sheet, so a brand added to the sheet later is included. If that name is not listed, Chat says so instead of inventing an id.",
    screen: "sheet",
  },
  {
    id: "member",
    chapter: "Promptie",
    time: "1:30",
    title: "Build a member JSON",
    body: "Open Member, or ask Chat for a member JSON. Give the project name and the live or Lovable link. Site id and widget come from the sheet when the brand is listed; otherwise type them or leave them empty. Colors are read from that link. Paste Drive links for the logo and favicon when you have them, then copy the JSON.",
    screen: "member",
  },
  {
    id: "testing",
    chapter: "Promptie",
    time: "1:36",
    title: "Run the full test",
    body: "Open Testing and paste the live or Lovable link. The run opens a temporary inbox, places the order, reads both mails, sets the member password, checks the orders, and submits an intake when one is offered. The report shows the member id and the password that was set. Export it as Excel or PDF.",
    screen: "testing",
  },
]

export function GuideStory() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const scene = scenes[index]

  useEffect(() => {
    if (!playing) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % scenes.length)
    }, SCENE_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index])

  function go(next: number) {
    setIndex((next + scenes.length) % scenes.length)
  }

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-accent uppercase">{scene.chapter} example</p>
      <h3 key={scene.id} className="guide-rise mt-1 text-2xl font-semibold tracking-tight text-ink">
        {scene.title}
      </h3>
      <p key={`${scene.id}-body`} className="guide-rise mt-2 max-w-3xl text-sm leading-6 text-muted">
        {scene.body}
      </p>
      <div className="mt-5 grid items-start gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
      <div>
        <Stage screen={scene.screen} sceneKey={scene.id} />
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-rail" onClick={() => go(index - 1)}>
            Back
          </button>
          <button
            type="button"
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-rail" onClick={() => go(index + 1)}>
            Next
          </button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-rail">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((index + 1) / scenes.length) * 100}%` }} />
        </div>
        <p className="mt-2 text-center text-[11px] tracking-wide text-muted uppercase">
          {scene.chapter} · {scene.time}
        </p>
      </div>

      <div className="min-h-0">
        <ol className="max-h-[28rem] space-y-1 overflow-auto pr-1">
          {scenes.map((item, itemIndex) => {
            const active = itemIndex === index
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${active ? "bg-accent-soft" : "hover:bg-rail"}`}
                  onClick={() => {
                    setIndex(itemIndex)
                    setPlaying(false)
                  }}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? "bg-accent text-white" : "bg-rail text-muted"}`}>
                    {itemIndex + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                    <span className="block text-[11px] text-muted">{item.chapter}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
      </div>
    </div>
  )
}

function Stage({ screen, sceneKey }: { screen: Screen; sceneKey: string }) {
  return (
    <div className="mx-auto w-[250px] rounded-[2rem] bg-ink p-2 shadow-[0_24px_60px_rgba(20,36,30,0.28)]">
      <div className="overflow-hidden rounded-[1.6rem] bg-[#f6f1e6]">
        <div className="flex items-center justify-between px-4 pt-2 text-[10px] text-ink/70">
          <span>9:41</span>
          <span className="h-4 w-16 rounded-full bg-ink" />
          <span>5G</span>
        </div>
        <div key={sceneKey} className="guide-rise h-[390px]">
          <ScreenView screen={screen} />
        </div>
      </div>
    </div>
  )
}

function ScreenView({ screen }: { screen: Screen }) {
  if (screen === "home") return <StoreHome />
  if (screen === "product") return <StoreProduct />
  if (screen === "cart") return <StoreCart />
  if (screen === "details") return <StoreDetails />
  if (screen === "payment") return <StorePayment />
  if (screen === "thanks") return <StoreThanks />
  if (screen === "inbox") return <StoreInbox />
  if (screen === "portal") return <StorePortal />
  if (screen === "intake") return <StoreIntake />
  if (screen === "legal") return <StoreLegal />
  if (screen === "signin") return <PromptieSignIn />
  if (screen === "company") return <PromptieCompany />
  if (screen === "one") return <PromptieOne />
  if (screen === "merge") return <PromptieMerge />
  if (screen === "sheet") return <PromptieSheet />
  if (screen === "member") return <PromptieMember />
  return <PromptieTesting />
}

function StoreChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between bg-[#12352b] px-3 py-2 text-white">
        <span className="text-[11px] font-semibold tracking-wide">ShapeMeds</span>
        <span className="rounded-full border border-white/30 px-2 py-0.5 text-[9px]">Cart 2</span>
      </div>
      <div className="min-h-0 flex-1 px-3 py-3">{children}</div>
    </div>
  )
}

function StoreHome() {
  return (
    <StoreChrome>
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[#0e6b52] uppercase">Weight care</p>
      <p className="mt-1 text-lg leading-5 font-semibold text-[#14241e]">Physician-guided treatment</p>
      <div className="mt-3 space-y-2">
        {["Semaglutide", "Tirzepatide"].map((name) => (
          <div key={name} className="rounded-xl border border-[#e3dacb] bg-white px-3 py-2">
            <p className="text-xs font-semibold">{name}</p>
            <p className="text-[10px] text-[#5c6b64]">View treatment</p>
          </div>
        ))}
      </div>
    </StoreChrome>
  )
}

function StoreProduct() {
  return (
    <StoreChrome>
      <p className="text-[10px] text-[#5c6b64]">← Weight loss</p>
      <p className="mt-1 text-base font-semibold">Semaglutide</p>
      <p className="mt-3 text-[10px] font-semibold tracking-wide text-[#5c6b64] uppercase">Dose</p>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {["0.25 mg", "0.5 mg", "1 mg"].map((dose, index) => (
          <span key={dose} className={`rounded-lg border px-1 py-1 text-center text-[9px] font-semibold ${index === 0 ? "border-[#0e6b52] bg-[#e4f3ec] text-[#0e6b52]" : "border-[#e3dacb] bg-white"}`}>
            {dose}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10px] font-semibold tracking-wide text-[#5c6b64] uppercase">Supply</p>
      <div className="mt-1 rounded-xl border border-[#0e6b52] bg-[#e4f3ec] px-2 py-2 text-[11px] font-semibold">Monthly · $199</div>
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Add to Cart</div>
    </StoreChrome>
  )
}

function StoreCart() {
  return (
    <StoreChrome>
      <p className="text-base font-semibold">Shopping cart</p>
      <div className="mt-3 space-y-2">
        {["Semaglutide — Monthly", "Tirzepatide — Monthly"].map((item) => (
          <div key={item} className="rounded-xl border border-[#e3dacb] bg-white px-2 py-2 text-[11px] font-medium">
            {item}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[#5c6b64]">Discount codes are applied at checkout.</p>
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Checkout</div>
    </StoreChrome>
  )
}

function StoreDetails() {
  return (
    <StoreChrome>
      <p className="text-[10px] font-semibold tracking-wide text-[#0e6b52] uppercase">1 · Contact & shipping</p>
      <div className="mt-2 space-y-1.5">
        <Field label="Email" value="member@clinic.com" />
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="First" value="Quinn" />
          <Field label="Last" value="Hale" />
        </div>
        <Field label="State" value="Texas" />
      </div>
      <div className="mt-2 space-y-1">
        <Consent label="HIPAA Authorization" />
        <Consent label="Telehealth Consent" />
      </div>
      <div className="mt-2 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Continue to payment</div>
    </StoreChrome>
  )
}

function StorePayment() {
  return (
    <StoreChrome>
      <p className="text-[10px] font-semibold tracking-wide text-[#0e6b52] uppercase">2 · Payment</p>
      <div className="mt-2 rounded-xl border border-[#0e6b52] bg-[#e4f3ec] px-2 py-2">
        <p className="text-[10px] font-semibold text-[#0e6b52]">Live Stripe · GLOBAL100</p>
        <p className="mt-1 text-[10px] leading-4 text-[#5c6b64]">Applied after the member email is valid. A test key skips this coupon.</p>
      </div>
      <div className="mt-3 rounded-xl border border-[#e3dacb] bg-white px-2 py-3 text-center text-[10px] text-[#5c6b64]">Card</div>
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Place order</div>
    </StoreChrome>
  )
}

function StoreThanks() {
  return (
    <StoreChrome>
      <div className="mx-auto mt-4 grid h-10 w-10 place-items-center rounded-full bg-[#0e6b52] text-sm text-white">✓</div>
      <p className="mt-3 text-center text-base font-semibold">Order confirmed</p>
      <div className="mt-3 rounded-xl border border-[#e3dacb] bg-white px-2 py-2 text-center">
        <p className="text-[9px] tracking-wide text-[#5c6b64] uppercase">Order number</p>
        <p className="text-sm font-semibold">184295</p>
      </div>
      <div className="mt-2 rounded-xl border border-[#e3dacb] bg-white px-2 py-2 text-center">
        <p className="text-[9px] tracking-wide text-[#5c6b64] uppercase">Member email</p>
        <p className="text-[11px] font-semibold">member@clinic.com</p>
      </div>
    </StoreChrome>
  )
}

function StoreInbox() {
  return (
    <StoreChrome>
      <p className="text-sm font-semibold">Inbox</p>
      <div className="mt-2 space-y-2">
        {["Order confirmation", "Welcome, member login"].map((title) => (
          <div key={title} className="rounded-xl border border-[#e3dacb] bg-white px-2 py-2">
            <p className="text-[11px] font-semibold">{title}</p>
            <p className="text-[10px] text-[#5c6b64]">support@store.com</p>
          </div>
        ))}
      </div>
    </StoreChrome>
  )
}

function StorePortal() {
  return (
    <StoreChrome>
      <p className="text-sm font-semibold">Change your password</p>
      <p className="mt-1 text-[10px] text-[#5c6b64]">Set a new password, then sign in again.</p>
      <div className="mt-3 space-y-2">
        <div className="rounded-lg border border-[#e3dacb] bg-white px-2 py-1.5 text-[11px]">New password</div>
        <div className="rounded-lg border border-[#e3dacb] bg-white px-2 py-1.5 text-[11px]">Confirm password</div>
        <div className="rounded-lg bg-[#0e6b52] px-2 py-1.5 text-center text-[11px] font-semibold text-white">Update password</div>
      </div>
    </StoreChrome>
  )
}

function StoreIntake() {
  return (
    <StoreChrome>
      <p className="text-[10px] font-semibold tracking-wide text-[#0e6b52] uppercase">Action required</p>
      <div className="mt-2 rounded-xl border border-[#e3dacb] bg-white px-2 py-2">
        <p className="text-[11px] font-semibold">Metformin · 1 month</p>
        <p className="text-[10px] text-[#5c6b64]">Order on the portal</p>
        <p className="mt-2 rounded-lg bg-[#e4f3ec] px-2 py-1 text-center text-[10px] font-semibold text-[#0e6b52]">Complete medical intake</p>
      </div>
    </StoreChrome>
  )
}

function StoreLegal() {
  const pages = ["Privacy", "Terms", "Telehealth", "HIPAA Notice", "HIPAA Authorization", "Returns"]
  return (
    <StoreChrome>
      <p className="text-sm font-semibold">Footer legal</p>
      <ul className="mt-2 space-y-1">
        {pages.map((page) => (
          <li key={page} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[11px]">
            <span>{page}</span>
            <span className="text-[#0e6b52]">Pass</span>
          </li>
        ))}
      </ul>
    </StoreChrome>
  )
}

function PromptieSignIn() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-4">
      <div className="rounded-2xl border border-[#e3dacb] bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#0e6b52] text-xs font-semibold text-white">P</span>
          <span className="text-sm font-semibold">Promptie</span>
        </div>
        <div className="mt-4 rounded-lg border border-[#e3dacb] py-2 text-center text-[11px] font-semibold">Continue with Google</div>
      </div>
    </div>
  )
}

function PromptieCompany() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-3">
      <p className="text-sm font-semibold">Companies</p>
      <p className="mt-2 text-[10px] leading-4 text-[#5c6b64]">No sample brands. Add the one you are working on.</p>
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">New company</div>
      <div className="mt-3 rounded-xl border border-[#e3dacb] bg-white px-2 py-2 text-[10px] leading-4 text-[#5c6b64]">
        Site id, chat widget, and member JSON still work with no company selected.
      </div>
    </div>
  )
}

function PromptieOne() {
  return (
    <div className="flex h-full flex-col bg-[#14241e] text-white">
      <div className="flex items-center justify-between px-3 py-2 text-[10px]">
        <span className="font-semibold">Promptie</span>
        <span className="rounded-md bg-white/10 px-2 py-1">ShapeMeds</span>
      </div>
      <div className="m-3 rounded-xl bg-[#f6f1e6] p-3 text-[#14241e]">
        <p className="text-[10px] text-[#5c6b64]">One prompt checked</p>
        <p className="mt-1 text-sm font-semibold">Stripe checkout</p>
        <p className="mt-2 rounded-md bg-white px-2 py-2 font-mono text-[10px] leading-4">{`site {{site_id}}`}</p>
        <div className="mt-3 rounded-full bg-[#0e6b52] py-1.5 text-center text-[10px] font-semibold text-white">Modify this prompt</div>
      </div>
    </div>
  )
}

function PromptieMerge() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-3">
      <p className="text-[10px] font-semibold tracking-wide text-[#5c6b64] uppercase">Chat</p>
      {["Stripe + create order", "PAP click and sale"].map((title) => (
        <div key={title} className="mt-2 flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-[11px]">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-[#0e6b52] text-[9px] text-white">✓</span>
          {title}
        </div>
      ))}
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Merge selected prompts</div>
      <div className="mt-3 rounded-xl border border-[#0e6b52] bg-[#e4f3ec] px-2 py-2 text-[11px] font-semibold text-[#0e6b52]">One prompt · Add to library</div>
    </div>
  )
}

function PromptieSheet() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-3">
      <p className="text-[10px] font-semibold tracking-wide text-[#5c6b64] uppercase">Chat</p>
      <div className="mt-2 ml-auto max-w-[92%] rounded-xl bg-[#e4f3ec] px-2 py-2 text-[10px] leading-4">
        What is the site id and chat widget for this brand?
      </div>
      <div className="mt-2 rounded-xl border border-[#e3dacb] bg-white px-2 py-2 text-[10px] leading-4">
        <p className="font-semibold">From the live sheet</p>
        <p className="mt-1">Site id 450</p>
        <p>Widget 6a84be0c56eb8ca70386b9e8</p>
      </div>
    </div>
  )
}

function PromptieMember() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-3">
      <p className="text-sm font-semibold">Member JSON</p>
      <div className="mt-2 rounded-lg border border-[#e3dacb] bg-white px-2 py-1.5 text-[10px]">Project name</div>
      <div className="mt-1 rounded-lg border border-[#0e6b52] bg-white px-2 py-1.5 text-[10px]">https://brand.com</div>
      <p className="mt-2 text-[10px] leading-4 text-[#5c6b64]">Site id and widget from the sheet. Colors from the link.</p>
      <div className="mt-2 rounded-xl bg-[#14241e] px-2 py-2 font-mono text-[9px] leading-4 text-white">
        <p>{`"siteId": "450"`}</p>
        <p className="text-[#b6f5d4]">{`"primary": "#D96B2B"`}</p>
      </div>
    </div>
  )
}

function PromptieTesting() {
  return (
    <div className="flex h-full flex-col bg-[#f3efe6] px-3 py-3">
      <p className="text-sm font-semibold">Flow testing</p>
      <p className="mt-2 text-[9px] tracking-wide text-[#5c6b64] uppercase">Store link</p>
      <div className="mt-1 rounded-lg border border-[#e3dacb] bg-white px-2 py-2 text-[10px]">https://shapemeds.com</div>
      <p className="mt-2 text-[9px] tracking-wide text-[#5c6b64] uppercase">Member email</p>
      <div className="mt-1 rounded-lg border border-[#0e6b52] bg-white px-2 py-2 text-[10px] font-semibold">member@clinic.com</div>
      <div className="mt-3 rounded-full bg-[#0e6b52] py-2 text-center text-[11px] font-semibold text-white">Run test</div>
      <div className="mt-3 rounded-xl bg-[#14241e] px-2 py-2 text-[10px] text-white">
        <p>Order 184295</p>
        <p className="mt-1 text-white/70">member@clinic.com</p>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e3dacb] bg-white px-2 py-1">
      <p className="text-[8px] tracking-wide text-[#5c6b64] uppercase">{label}</p>
      <p className="text-[10px] font-medium">{value}</p>
    </div>
  )
}

function Consent({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-[#0e6b52] text-[8px] text-white">✓</span>
      {label}
    </div>
  )
}
