import { companion } from "./companion.js";
const $ = (s) => document.querySelector(s),
  actor = companion();
let csrf = "",
  recipient = "",
  challenge = "",
  expires = 0,
  resendAt = 0,
  busy = false,
  mode = "signin",
  signedIn = false,
  generation = 0,
  controller;
const destination = (() => {
  try {
    const raw =
        new URLSearchParams(location.search).get("returnTo") ||
        "/explorer.html",
      url = new URL(raw, location.origin);
    if (
      url.origin !== location.origin ||
      !["/", "/explorer.html"].includes(url.pathname)
    )
      return "/explorer.html";
    const endpoint = url.searchParams.get("endpoint");
    return (
      url.pathname +
      (url.pathname === "/explorer.html" &&
      endpoint &&
      /^[a-zA-Z0-9._-]{1,64}$/.test(endpoint)
        ? "?endpoint=" + encodeURIComponent(endpoint)
        : "")
    );
  } catch {
    return "/explorer.html";
  }
})();
$(".continue").href = destination;
function status(text, error = false, state = "idle") {
  $("#auth-status").textContent = text;
  $("#auth-status").dataset.kind = error ? "error" : "status";
  actor.state(state);
}
function lock(value) {
  busy = value;
  for (const el of document.querySelectorAll(".auth-panel button"))
    el.disabled = value && !el.classList.contains("change-email");
  $(".send").setAttribute("aria-busy", String(value));
  $(".verify").setAttribute("aria-busy", String(value));
  tick();
}
async function api(path, data) {
  controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch("/api/v1/auth/" + path, {
      method: data === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers:
        data === undefined
          ? {}
          : { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
    const payload = r.status === 204 ? {} : await r.json();
    if (!r.ok) {
      const error = new Error(
        payload.message ||
          payload.error ||
          "Sign-in is temporarily unavailable.",
      );
      error.status = r.status;
      throw error;
    }
    const result = payload.result || {};
    if (result.csrf) csrf = result.csrf;
    return result;
  } finally {
    clearTimeout(t);
  }
}
function show(step) {
  $("#email-form").hidden = step !== "email";
  $("#code-form").hidden = step !== "code";
  $("#signed-in").hidden = step !== "session";
  $(".retry").hidden = true;
}
async function bootstrap() {
  lock(true);
  try {
    const result = await api("session");
    signedIn = result.authenticated;
    if (signedIn) {
      show("session");
      $(".identity").textContent = result.account.email;
      status("Your session is active. Continue when you’re ready.");
    } else {
      show("email");
      mode = "signin";
      status("Enter your email to receive a one-time code.");
    }
    lock(false);
  } catch (e) {
    show("email");
    lock(false);
    $(".send").disabled = true;
    $(".retry").hidden = false;
    status(
      e.message || "Could not connect. Please retry.",
      true,
      "server error",
    );
  }
}
function tick() {
  const remaining = Math.max(0, Math.ceil((expires - Date.now()) / 1000)),
    cooldown = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
  if (!$("#code-form").hidden) {
    $("#expires").textContent = remaining
      ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}.`
      : "This code has expired. Request a new code.";
    $(".resend").disabled = busy || cooldown > 0;
    $(".resend").textContent = cooldown
      ? `Resend in ${cooldown}s`
      : "Resend code";
    $(".verify").disabled = busy || remaining === 0;
  }
}
function mask(email) {
  const at = email.indexOf("@");
  return email.slice(0, 1) + "•••" + email.slice(at);
}
async function send() {
  const version = ++generation;
  lock(true);
  status("Requesting your code…", false, "loading");
  try {
    const result = await api(
      mode === "reauth" ? "reauth/start" : "email/start",
      mode === "reauth" ? {} : { email: recipient },
    );
    if (version !== generation) return;
    challenge = result.challenge_id;
    expires = Date.now() + result.expires_in * 1000;
    resendAt = Date.now() + result.resend_after * 1000;
    $("#code").value = "";
    $("#code").removeAttribute("aria-invalid");
    $(".change-email").textContent =
      mode === "reauth" ? "Back to account" : "Change email";
    $(".recipient").textContent =
      mode === "reauth"
        ? "Enter the code sent to your account email."
        : `If this address can receive mail, a code will arrive at ${mask(recipient)}.`;
    show("code");
    status("Check your inbox. Enter the code here to continue.");
    lock(false);
    $("#code").focus();
  } catch (e) {
    if (version !== generation) return;
    status(
      e.name === "AbortError"
        ? "The request timed out. Try again when you’re ready."
        : e.message,
      true,
      e.status === 429 ? "rate limit" : "server error",
    );
    lock(false);
    if (e.status === 503) {
      try {
        await api("session");
      } catch {}
      show("email");
    }
    if (e.status === 403 || e.status === 400) {
      $(".retry").hidden = false;
      $(".retry").textContent = "Restart secure sign-in";
    }
    if (e.status === 429) {
      resendAt = Date.now() + 60000;
      tick();
    }
  }
}
$("#email-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return;
  const input = $("#email");
  if (!input.value.trim() || !input.checkValidity()) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
    status("Enter a valid email address.", true, "invalid parameters");
    return;
  }
  input.removeAttribute("aria-invalid");
  recipient = input.value.trim().toLowerCase();
  mode = "signin";
  send();
});
$("#code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const value = $("#code").value;
  if (!/^\d{8}$/.test(value)) {
    $("#code").setAttribute("aria-invalid", "true");
    $("#code").focus();
    status(
      "Enter all eight digits, including any leading zero.",
      true,
      "invalid parameters",
    );
    return;
  }
  const version = ++generation;
  lock(true);
  status("Verifying your code…", false, "loading");
  try {
    const result = await api(
      mode === "reauth" ? "reauth/verify" : "email/verify",
      { challenge_id: challenge, code: value },
    );
    $("#code").value = "";
    if (version !== generation) return;
    if (result.state === "signed_in") {
      signedIn = true;
      show("session");
      $(".identity").textContent = result.account.email;
      status(
        mode === "reauth"
          ? "Email verified. Sensitive session actions are available for five minutes."
          : "You’re signed in. Continue to your intended page.",
        false,
        "success",
      );
    } else {
      show("email");
      status(
        result.state === "registration_closed"
          ? "New registration is currently closed. The manual API-key playground is available."
          : "This account needs operator-reviewed enrollment. Contact the operator with your ownership evidence; email alone cannot claim an existing account.",
        true,
        "authentication failure",
      );
      $(".retry").hidden = false;
      $(".retry").textContent = "Start a new sign-in";
    }
    lock(false);
  } catch (error) {
    $("#code").value = "";
    if (version !== generation) return;
    $("#code").setAttribute("aria-invalid", "true");
    status(
      error.name === "AbortError"
        ? "Verification timed out. Restart sign-in if the code was already used."
        : error.message,
      true,
      error.status === 429 ? "rate limit" : "authentication failure",
    );
    lock(false);
    if (error.status === 403 || error.status === 401) {
      $(".retry").hidden = false;
      $(".retry").textContent = "Restart secure sign-in";
    }
  }
});
$(".resend").addEventListener("click", () => {
  if (!busy && Date.now() >= resendAt) send();
});
$(".change-email").addEventListener("click", async () => {
  generation++;
  controller?.abort();
  $("#code").value = "";
  try {
    await api("email/cancel", {});
  } catch (e) {
    if (e.status !== 403 && e.status !== 401) {
      lock(false);
      status(
        "Could not cancel this code. Check your connection and try again.",
        true,
        "server error",
      );
      return;
    }
  }
  recipient = "";
  challenge = "";
  expires = 0;
  await bootstrap();
  if (!signedIn) $("#email").focus();
});
$(".retry").addEventListener("click", () => {
  generation++;
  controller?.abort();
  $("#code").value = "";
  bootstrap();
});
$(".reauth").addEventListener("click", () => {
  mode = "reauth";
  send();
});
async function logout(all) {
  if (busy) return;
  lock(true);
  try {
    await api(all ? "logout-all" : "logout", {});
    recipient = "";
    $("#email").value = "";
    $("#code").value = "";
    csrf = "";
    await bootstrap();
    status(all ? "Signed out everywhere." : "Signed out.");
  } catch (e) {
    lock(false);
    status(e.message, true, "authentication failure");
  }
}
$(".logout").addEventListener("click", () => logout(false));
$(".logout-all").addEventListener("click", () => logout(true));
$("#email").addEventListener("focus", () => actor.state("input focus"));
$("#code").addEventListener("focus", () => actor.state("input focus"));
const timer = setInterval(tick, 1000);
window.addEventListener("pagehide", () => {
  generation++;
  controller?.abort();
  clearInterval(timer);
  $("#email").value = "";
  $("#code").value = "";
  csrf = "";
  recipient = "";
  challenge = "";
});
bootstrap();
