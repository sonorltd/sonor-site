/* Sonor Site — static config (window.__SITE_CONFIG__). Engineering refs only — project data lives in Supabase (SITE-ARCHITECTURE.md). */
(function () {
  window.__SITE_CONFIG__ = {
    version: '0.4.0',
    buildDate: '2026-11-10',
    appKey: 'site',
    outbox: 'sonor-site',                       // SonorOutbox IndexedDB name (this app's own queue)
    buckets: { photos: 'site-photos', plans: 'takeoffs-plans' },
    photoMax: 1600, photoQuality: 0.86          // photos downscaled on the device before upload
  };
})();
