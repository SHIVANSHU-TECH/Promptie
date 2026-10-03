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

function browserCandidates() {
  const roots = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]].filter(
    (value): value is string => Boolean(value),
  )
  return [
    ...roots.map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe")),
    ...roots.map((root) => join(root, "Microsoft", "Edge", "Application", "msedge.exe")),
  ]
}

export class BrowserRun {
  private constructor(
    private process: ChildProcess,
    private profile: string,
    readonly page: PageSession,
  ) {}

  static async launch() {
    let executable = ""
    for (const candidate of browserCandidates()) {
      try {
        await access(candidate)
        executable = candidate
        break
      } catch {
        /* try the next installed browser */
      }
    }
    if (!executable) throw new Error("Chrome or Edge is required to run the checkout flow.")

    const port = await freePort()
    const profile = await mkdtemp(join(tmpdir(), "promptie-flow-"))
    const child = spawn(
      executable,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    )
    const pageSocket = await waitForPage(port)
    const page = await PageSession.connect(pageSocket)
    await page.send("Page.enable")
    await page.send("Runtime.enable")
    return new BrowserRun(child, profile, page)
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

  async viewport(width: number, height: number, mobile: boolean) {
    await this.page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
  }

  async close() {
    this.page.close()
    this.process.kill()
    await rm(this.profile, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function waitForPage(port: number) {
  const started = Date.now()
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) {
        const pages = (await response.json()) as { type: string; webSocketDebuggerUrl: string }[]
        const page = pages.find((item) => item.type === "page")
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
      }
    } catch {
      /* browser is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("The browser did not open a page.")
}
