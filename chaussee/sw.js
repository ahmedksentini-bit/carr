// Service worker vide : le bureau des chaussées est servi en ligne par INFRA-KSR (pas de cache hors ligne).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => { if (e.data?.type === "version") e.ports[0]?.postMessage({ version: "infra-ksr" }); });
