/**
 * Register the service worker and apply a waiting update on this visit
 * ("update on next open"): a new worker found during a session stays waiting
 * until the app is opened again, then it activates and the page reloads once.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void bootServiceWorker();
  });
}

export async function bootServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const base = import.meta.env.BASE_URL || "/";
    const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    void reg.update();
    const waiting = reg.waiting;
    if (waiting && navigator.serviceWorker.controller) {
      await activateWaiting(waiting);
    }
  } catch {
    // Offline cache is optional; the app still runs.
  }
}

function activateWaiting(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    worker.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(() => resolve(), 2000);
  });
}
