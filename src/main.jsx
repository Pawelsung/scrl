import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

async function cleanupLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    console.log('[SW] cleanup complete');
  } catch (err) {
    console.warn('[SW] cleanup failed', err);
  }
}

cleanupLegacyServiceWorkers();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
