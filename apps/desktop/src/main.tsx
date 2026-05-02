import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import "./styles.css";

// Apply theme BEFORE first paint so we don't flash a blank/white screen.
applyTheme(getStoredTheme());

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
