import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      console.log('[PWA] Stale Service Workers found. Unregistering and clearing caches...');
      Promise.all(registrations.map(r => r.unregister())).then(() => {
        caches.keys().then((keys) => {
          Promise.all(keys.map(k => caches.delete(k))).then(() => {
            console.log('[PWA] Caches cleared. Reloading page...');
            window.location.reload();
          });
        }).catch(() => {
          window.location.reload();
        });
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
