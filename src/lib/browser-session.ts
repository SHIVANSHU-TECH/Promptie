import { spawn, type ChildProcess } from "child_process"
import { access, mkdtemp, rm } from "fs/promises"
import { createServer } from "net"
import { tmpdir } from "os"
import { join } from "path"

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export class PageSession {
  private nextId = 0
  private pending = new Map<number, Pending>()
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(private ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number
        result?: unknown
        error?: { message?: string }
      }
      if (!message.id || !this.pending.has(message.id)) return
      const waiter = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (!waiter) return
      if (message.error) waiter.reject(new Error(message.error.message || "Browser command failed"))
      else waiter.resolve(message.result)
    })
  }

  static async connect(url: string) {
    const ws = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true })
      ws.addEventListener("error", () => reject(new Error("Could not connect to the browser.")), { once: true })
    })
    return new PageSession(ws)
  }

  send<T>(method: string, params: Record<string, unknown> = {}) {
    const task = this.queue.then(() => this.dispatch<T>(method, params))
    this.queue = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }

  private dispatch<T>(method: string, params: Record<string, unknown>) {
    const id = ++this.nextId
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate<T>(expression: string) {
    const result = await this.send<{ result?: { value?: T }; exceptionDetails?: { text?: string } }>(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
    )
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Page script failed")
    }
    return result.result?.value as T
  }

  close() {
    this.ws.close()
  }
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function envValue(name: string) {
  const value = process.env[name]
  return typeof value === "string" ? value : ""
}

function browserCandidates() {
  const roots = [
    envValue("LOCALAPPDATA"),
    envValue("PROGRAMFILES"),
    envValue("ProgramFiles"),
    envValue("PROGRAMFILES(X86)"),
    envValue("ProgramFiles(x86)"),
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter(Boolean)
  const names = [
    ["Google", "Chrome", "Application", "chrome.exe"],
    ["Microsoft", "Edge", "Application", "msedge.exe"],
  ]
  return [...new Set(roots.flatMap((root) => names.map((parts) => join(root, ...parts))))]
}

async function findExecutable() {
  for (const candidate of browserCandidates()) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* try the next installed browser */
    }
  }
  return ""
}

async function serverlessBrowser() {
  const chromium = (await import("@sparticuz/chromium")).default
  chromium.setGraphicsMode = false
  const executable = await chromium.executablePath()
  const args = chromium.args.filter(
    (arg) => !arg.startsWith("--remote-debugging-port") && !arg.startsWith("--user-data-dir"),
  )
  return { executable, args }
}

export class BrowserRun {
  private layout = { width: 1280, height: 800, mobile: false }

  private constructor(
    private process: ChildProcess,
    private profile: string,
    readonly page: PageSession,
  ) {}

  static async launch() {
    const port = await freePort()
    const profile = await mkdtemp(join(tmpdir(), "promptie-flow-"))
    const local = await findExecutable()
    let executable = local
    let args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ]
    if (!executable) {
      const hosted = await serverlessBrowser()
      executable = hosted.executable
      args = [
        "--disable-dev-shm-usage",
        ...hosted.args.map((arg) => (arg === "--headless='shell'" ? "--headless=shell" : arg)),
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "about:blank",
      ]
    }
    if (!executable) throw new Error("Chrome or Edge is required to run the checkout flow.")

    let output = ""
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] })
    const remember = (chunk: Buffer | string) => {
      output = `${output}${chunk.toString()}`.slice(-1200)
    }
    child.stdout?.on("data", remember)
    child.stderr?.on("data", remember)
    try {
      const pageSocket = await waitForPage(port)
      const page = await PageSession.connect(pageSocket)
      await page.send("Page.enable")
      await page.send("Runtime.enable")
      return new BrowserRun(child, profile, page)
    } catch (error) {
      child.kill()
      await rm(profile, { recursive: true, force: true }).catch(() => undefined)
      const detail = output.trim().replace(/\s+/g, " ").slice(-280)
      const message = error instanceof Error ? error.message : "The browser did not open a page."
      throw new Error(detail ? `${message} ${detail}` : message)
    }
  }

  async goto(url: string) {
    await this.page.send("Page.navigate", { url })
    const started = Date.now()
    while (Date.now() - started < 20000) {
      const state = await this.page.evaluate<string>("document.readyState").catch(() => "loading")
      if (state === "complete") return
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`The page did not finish loading: ${url}`)
  }

  async shot() {
    const shot = await this.page.send<{ data?: string }>("Page.captureScreenshot", {
      format: "jpeg",
      quality: 42,
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: this.layout.width,
        height: this.layout.height,
        scale: 1,
      },
    })
    return shot.data || ""
  }

  private async settle() {
    await this.page
      .evaluate(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`)
      .catch(() => undefined)
  }

  async viewport(width: number, height: number, mobile: boolean) {
    this.layout = { width, height, mobile }
    await this.page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
  }

  async captureLayouts() {
    const previous = { ...this.layout }
    let phone = ""
    let laptop = ""
    try {
      await this.viewport(390, 844, true)
      await this.settle()
      phone = await this.shot()
      await this.viewport(1280, 800, false)
      await this.settle()
      laptop = await this.shot()
    } finally {
      const same =
        this.layout.width === previous.width &&
        this.layout.height === previous.height &&
        this.layout.mobile === previous.mobile
      if (!same) await this.viewport(previous.width, previous.height, previous.mobile)
    }
    return { phone, laptop }
  }

  async close() {
    this.page.close()
    this.process.kill()
    await rm(this.profile, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function listedPages(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!response.ok) return []
  return (await response.json()) as { id?: string; type: string; webSocketDebuggerUrl: string }[]
}

async function waitForPage(port: number) {
  const started = Date.now()
  let opened = false
  while (Date.now() - started < 20000) {
    try {
      const pages = await listedPages(port)
      const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
      if (!opened) {
        const version = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (version.ok) {
          const browser = (await version.json()) as { webSocketDebuggerUrl?: string }
          if (browser.webSocketDebuggerUrl) {
            const session = await PageSession.connect(browser.webSocketDebuggerUrl)
            await session.send("Target.createTarget", { url: "about:blank" })
            session.close()
            opened = true
          }
        }
      }
    } catch {
      /* browser is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("The browser did not open a page.")
}
