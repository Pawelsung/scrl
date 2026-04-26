import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

async function cleanupServiceWorkersInDevOnly() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.DEV) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    console.log('[SW] dev cleanup complete');
  } catch (err) {
    console.warn('[SW] dev cleanup failed', err);
  }
}

cleanupServiceWorkersInDevOnly();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.error("SW registration failed:", err);
    });
  });
}
