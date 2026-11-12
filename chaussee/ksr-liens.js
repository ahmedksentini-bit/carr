// Garde-fou des liens du bureau des chaussées dans INFRA-KSR (produit par tools/sync-chaussee.py).
(function () {
  var LOCALES = ["bureau.html", "fiches.html"], SITE = "https://chaussee.ksr-infra.org/";
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank" || e.defaultPrevented) return;
    var u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    var base = location.pathname.replace(/[^/]*$/, ""), rel = u.pathname.indexOf(base) === 0 ? u.pathname.slice(base.length) : null;
    if (rel === null || rel === "" || LOCALES.indexOf(rel) >= 0) return;
    e.preventDefault();
    window.open(SITE + rel + u.search + u.hash, "_blank", "noopener");
  }, true);
})();
