import { element, renderCard } from "./reviews-ui.mjs";
const status = document.querySelector("#reviews-status"),
  list = document.querySelector("#website-reviews"),
  more = document.querySelector("#reviews-more");
let offset = 0;
async function load() {
  try {
    more.disabled = true;
    const response = await fetch("/api/reviews?offset=" + offset);
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    for (const review of data.reviews)
      if (!document.getElementById("review-" + review.id))
        list.append(renderCard(review));
    status.textContent = list.children.length
      ? ""
      : "No website reviews have been published yet. You are welcome to share your experience.";
    offset = data.nextOffset;
    more.hidden = offset === null;
  } catch {
    status.textContent =
      "Website reviews are not available yet. Please try again later.";
  } finally {
    more.disabled = false;
  }
}
async function linkedReview() {
  const id = location.hash.replace("#review-", "");
  if (!location.hash.startsWith("#review-") || !/^[0-9a-f-]{36}$/i.test(id))
    return;
  try {
    if (!document.getElementById("review-" + id)) {
      const response = await fetch("/api/reviews?review=" + id);
      if (!response.ok) return;
      const data = await response.json();
      if (data.reviews[0]) list.prepend(renderCard(data.reviews[0]));
    }
    document.getElementById("review-" + id)?.scrollIntoView({ block: "start" });
  } catch {
    /* Missing or withdrawn reviews are never substituted. */
  }
}
more.addEventListener("click", load);
load().then(linkedReview);
window.addEventListener("hashchange", linkedReview);
const form = document.querySelector("#review-form"),
  message = document.querySelector("#review-form-status"),
  submit = document.querySelector("#review-submit"),
  fileInput = document.querySelector("#review-photos"),
  previews = document.querySelector("#review-photo-previews"),
  photoConsent = document.querySelector("#review-photo-consent");
let config,
  files = [],
  token = "",
  widget,
  session = null,
  requestId = crypto.randomUUID(),
  frozen = false,
  submitting = false;
function selection() {
  previews.replaceChildren();
  for (const [at, file] of files.entries()) {
    const li = element("li"),
      image = element("img");
    image.src = file.preview;
    image.alt = `Selected photograph ${at + 1}`;
    image.width = 100;
    image.height = 80;
    const remove = element("button", "", "Remove photograph " + (at + 1));
    remove.type = "button";
    remove.disabled = frozen;
    remove.onclick = () => {
      URL.revokeObjectURL(file.preview);
      files.splice(at, 1);
      selection();
    };
    li.append(image, remove);
    previews.append(li);
  }
  photoConsent.required = files.length > 0;
}
fileInput.addEventListener("change", () => {
  message.textContent = "";
  const selected = Array.from(fileInput.files);
  if (files.length + selected.length > 5) {
    message.textContent = "Select up to 5 photographs in total.";
    fileInput.value = "";
    return;
  }
  if (
    selected.some(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024 ||
        file.size === 0,
    )
  ) {
    message.textContent = "Use JPEG, PNG or WebP photographs up to 10 MB each.";
    fileInput.value = "";
    return;
  }
  for (const file of selected)
    files.push({
      file,
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
    });
  fileInput.value = "";
  selection();
});
function spamProtection() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector("script[data-review-turnstile]");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = element("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.dataset.reviewTurnstile = "";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}
async function configure() {
  try {
    const response = await fetch("/api/reviews/config");
    config = await response.json();
    if (!response.ok || !config.enabled) throw Error();
    for (const category of config.categories) {
      const option = element("option", "", category.name);
      option.value = category.id;
      form.elements.category.append(option);
    }
    document.querySelector("#review-photo-fields").hidden =
      !config.photosEnabled;
    await spamProtection();
    widget = window.turnstile.render("#review-turnstile", {
      sitekey: config.siteKey,
      action: "review",
      size: "flexible",
      callback: (value) => {
        token = value;
        submit.disabled = submitting;
      },
      "expired-callback": () => {
        token = "";
        if (!session) submit.disabled = true;
      },
      "error-callback": () => {
        token = "";
        if (!session) submit.disabled = true;
        message.textContent =
          "Spam protection could not load. Please retry or contact us.";
      },
    });
  } catch {
    message.textContent =
      "Online reviews are not configured yet. Please contact info@hometechmayo.ie.";
    submit.disabled = true;
  }
}
configure();
async function api(path, options = {}) {
  const response = await fetch("/api/reviews/" + path, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "The server could not be reached. Please retry without reloading.",
    );
  }
  if (!response.ok)
    throw Error(data.error || "Your review could not be submitted.");
  return data;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  if (!session && !form.reportValidity()) return;
  if (!session && !token) {
    message.textContent = "Complete spam protection.";
    return;
  }
  submitting = true;
  submit.disabled = true;
  message.textContent = "Submitting your review…";
  try {
    if (!session) {
      const data = Object.fromEntries(new FormData(form));
      session = await api("submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          rating: Number(data.rating),
          consent: form.elements.consent.checked,
          photoConsent: photoConsent.checked,
          photoCount: files.length,
          consentVersion: config.consentVersion,
          requestId,
          turnstileToken: token,
        }),
      });
      frozen = true;
      for (const field of form.querySelectorAll("input,textarea,select"))
        field.disabled = true;
      selection();
    }
    if (!session.complete) {
      for (const [at, item] of files.entries()) {
        message.textContent = `Uploading photograph ${at + 1} of ${files.length}…`;
        await api(`submissions/${session.id}/photos/${item.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": item.file.type,
            "X-Review-Upload-Token": session.uploadToken,
          },
          body: item.file,
        });
      }
      await api(`submissions/${session.id}/complete`, {
        method: "POST",
        headers: { "X-Review-Upload-Token": session.uploadToken },
      });
    }
    if (widget !== undefined) window.turnstile.remove(widget);
    document.querySelector("#review-turnstile").replaceChildren();
    form.hidden = true;
    const success = document.querySelector("#review-success");
    success.hidden = false;
    success.focus();
    for (const item of files) URL.revokeObjectURL(item.preview);
  } catch (error) {
    message.textContent =
      error.message +
      (session
        ? " Your saved submission remains private. Retry to continue."
        : "");
    if (!session && widget !== undefined) {
      token = "";
      window.turnstile.reset(widget);
    }
    submit.disabled = !session && !token;
    submit.textContent = session ? "Retry Submission" : "Submit Review";
  } finally {
    submitting = false;
    if (!form.hidden) submit.disabled = !session && !token;
  }
});
