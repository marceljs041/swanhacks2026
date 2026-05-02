import type { DesktopBridge } from "../../electron/preload.js";

declare global {
  interface Window {
    studynest: DesktopBridge;
  }
}

export {};
