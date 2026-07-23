(function () {
  "use strict";

  var form = document.querySelector("[data-newsletter-form]");
  if (!form || !window.NEWSLETTER_WORKER_URL) return;

  var token = form.querySelector("[data-evp-token]");
  var nonceField = form.querySelector("[data-evp-nonce]");
  var status = form.querySelector("[data-newsletter-status]");
  var button = form.querySelector("button[type='submit']");

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "";
  }

  fetch(window.NEWSLETTER_WORKER_URL + "/nonce", {
    credentials: "omit",
    headers: { Accept: "application/json" }
  })
    .then(function (response) {
      if (!response.ok) throw new Error("Could not prepare signup");
      return response.json();
    })
    .then(function (data) {
      nonceField.value = data.nonce;
      token.setAttribute("nonce", data.nonce);
    })
    .catch(function () {
      setStatus("Signup is temporarily unavailable. Please try again later.", "error");
      button.disabled = true;
    });

  var params = new URLSearchParams(window.location.search);
  var newsletterResult = params.get("newsletter");
  if (newsletterResult === "confirmed") {
    setStatus("You’re subscribed.", "success");
  } else if (newsletterResult === "check-email") {
    setStatus("Check your inbox to confirm your subscription.", "success");
  } else if (newsletterResult === "error") {
    setStatus("Signup failed. Please try again.", "error");
  }
})();
