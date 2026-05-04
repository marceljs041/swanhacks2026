import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BrowserWindow, app, ipcMain, shell } from "electron";
import { startSidecar, stopSidecar, waitForSidecar } from "./local-ai.js";

/** Vite dev server URL — plugin may omit env; fall back so we never load a missing dist/index.html. */
const devServerUrl =
  process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
const isDev = !app.isPackaged || !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function windowIconPath(): string | undefined {
  const rel =
    process.platform === "win32"
      ? "../build/desktopicon.ico"
      : "../build/desktopicon.icns";
  const p = join(__dirname, rel);
  return existsSync(p) ? p : undefined;
}

function createWindow(): void {
  const icon = windowIconPath();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#FBF5EC",
    ...(icon ? { icon } : {}),
    /** Inset traffic lights + seamless top; renderer paints a matching drag strip. */
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      /**
       * Packaged builds load the UI from `file://`. With default webSecurity,
       * the renderer cannot `fetch()` the local sidecar at http://127.0.0.1 …
       * ("Failed to fetch" / net::ERR_BLOCKED_BY_CLIENT). Dev uses http://5173
       * so same-origin rules differ — keep security on there.
       */
      webSecurity: isDev,
    },
  });

  if (isDev) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  // Start the local AI sidecar in the background. We don't block app
  // startup on it — the renderer polls /health.
  const sidecar = startSidecar();
  void waitForSidecar(sidecar.baseUrl).then((ok) => {
    console.log(`[main] sidecar ready: ${ok}`);
    mainWindow?.webContents.send("sidecar:ready", ok);
  });

  ipcMain.handle("app:get-paths", () => ({
    userData: app.getPath("userData"),
    documents: app.getPath("documents"),
    appData: app.getPath("appData"),
  }));

  ipcMain.handle("sidecar:base-url", () => sidecar.baseUrl);
  ipcMain.handle("sidecar:status", async () => {
    try {
      const res = await fetch(`${sidecar.baseUrl}/health`);
      return await res.json();
    } catch {
      return { ok: false, loaded: false, error: "unreachable" };
    }
  });

  const dbPath = () => join(app.getPath("userData"), "studynest.sqlite");

  ipcMain.handle("db:load-file", async () => {
    const p = dbPath();
    if (!existsSync(p)) return null;
    return readFileSync(p);
  });

  ipcMain.handle("db:save-file", async (_e, data: Uint8Array) => {
    const p = dbPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, Buffer.from(data));
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopSidecar();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopSidecar();
});
