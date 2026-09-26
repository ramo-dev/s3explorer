/**
 * Service worker registration.
 *
 * Production only. The worker caches same-origin GETs by path, and in dev every
 * module URL is stable while its contents are not -- registering there would
 * serve a stale bundle back to the browser and make HMR look broken.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // registration.requestUpdate() on load: the browser checks for a new worker
  // on navigation, but only if the last check was over an hour ago. A deploy
  // should not wait for that.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready.then(reg => reg.update()))
      .catch((error: unknown) => {
        // Non-fatal by design. Without a worker the app still works, it just
        // cannot be installed or opened offline, and a console error here would
        // read as a broken deploy.
        console.warn('Service worker registration failed', error);
      });
  });
}
