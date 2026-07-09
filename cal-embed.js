/* Cal.com inline booking embed loader (consulting page).
 *
 * Reads the target Cal.com link + namespace from the #cal-inline
 * container's data attributes, so the same script serves every locale.
 * The calendar's light/dark theme follows the site's current theme.
 *
 * To go live: replace the container's data-cal-link with the real
 * Cal.com handle and connect Stripe in Cal.com (Apps → Stripe) so the
 * paid event types collect payment as a condition of booking.
 */
(function () {
  var el = document.getElementById("cal-inline");
  if (!el) return;

  var calLink = el.getAttribute("data-cal-link");
  if (!calLink) return;

  var namespace = el.getAttribute("data-cal-namespace") || "consultation";
  var theme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";

  // Standard Cal.com embed bootstrap (loads embed.js on first call).
  (function (C, A, L) {
    var p = function (a, ar) {
      a.q.push(ar);
    };
    var d = C.document;
    C.Cal =
      C.Cal ||
      function () {
        var cal = C.Cal;
        var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () {
            p(api, arguments);
          };
          var ns = ar[1];
          api.q = api.q || [];
          if (typeof ns === "string") {
            cal.ns[ns] = cal.ns[ns] || api;
            p(cal.ns[ns], ar);
            p(cal, ["initNamespace", ns]);
          } else {
            p(cal, ar);
          }
          return;
        }
        p(cal, ar);
      };
  })(window, "https://app.cal.com/embed/embed.js", "init");

  window.Cal("init", namespace, { origin: "https://app.cal.com" });
  window.Cal.ns[namespace]("inline", {
    elementOrSelector: "#cal-inline",
    config: { layout: "month_view", theme: theme },
    calLink: calLink,
  });
  window.Cal.ns[namespace]("ui", {
    hideEventTypeDetails: false,
    layout: "month_view",
    theme: theme,
  });
})();
