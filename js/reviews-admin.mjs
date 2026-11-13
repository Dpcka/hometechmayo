import { element, renderCard, openGallery } from "./reviews-ui.mjs";
const status = document.querySelector("#admin-status"),
  list = document.querySelector("#admin-list"),
  detail = document.querySelector("#admin-detail"),
  filter = document.querySelector("#admin-filter"),
  more = document.querySelector("#admin-more");
let session,
  current,
  images = [],
  offset = 0,
  busy = false;
async function api(path = "", options = {}) {
  const response = await fetch("/api/reviews/admin" + path, {
    ...options,
    headers: {
      ...(options.body instanceof File
        ? {}
        : { "Content-Type": "application/json" }),
      "X-Review-CSRF": session?.csrf || "",
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error(
      "Owner sign-in expired or the service is unavailable. Reload to sign in again.",
    );
  }
  if (!response.ok) throw Error(data.error || "The operation failed.");
  return data;
}
async function load(reset = true) {
  try {
    if (reset) {
      offset = 0;
      list.replaceChildren();
    }
    const data = await api(
      "?status=" +
        (filter.value === "due" ? "approved" : filter.value) +
        (filter.value === "due" ? "&due=true" : "") +
        "&offset=" +
        offset,
    );
    for (const review of data.reviews) {
      const button = element(
        "button",
        "admin-review-item",
        `${review.customer_name} · ${review.rating}/5 · ${new Date(review.created_at).toLocaleDateString("en-IE")}`,
      );
      button.type = "button";
      button.dataset.review = review.id;
      button.onclick = () => select(review.id);
      list.append(button);
    }
    offset += data.reviews.length;
    more.hidden = data.reviews.length < 30;
  } catch (error) {
    status.textContent = error.message;
  }
}
async function select(id) {
  try {
    if (busy) return;
    status.textContent = "Loading review…";
    current = await api("/" + id);
    images = current.images.map((image) => ({
      ...image,
      status: image.approval_status,
    }));
    render();
    for (const button of list.querySelectorAll("button"))
      button.setAttribute("aria-current", String(button.dataset.review === id));
    status.textContent = "Review loaded.";
    document.querySelector("#admin-detail h2")?.focus();
  } catch (error) {
    status.textContent = error.message;
  }
}
function field(
  form,
  label,
  name,
  value,
  { type = "input", options, rows = 4 } = {},
) {
  const wrapper = element("label", "", label),
    input = element(options ? "select" : type);
  input.name = name;
  if (type === "textarea") input.rows = rows;
  if (options) {
    for (const [value, text] of options) {
      const option = element("option", "", text);
      option.value = value;
      input.append(option);
    }
  }
  input.value = value ?? "";
  wrapper.append(input);
  form.append(wrapper);
  return input;
}
function render() {
  detail.replaceChildren();
  const { review, notification, events } = current,
    form = element("form", "admin-editor");
  form.id = "admin-editor";
  const heading = element("h2", "", review.customer_name);
  heading.tabIndex = -1;
  form.append(
    heading,
    element(
      "p",
      "",
      `${review.rating}/5 · ${review.status} · ${new Date(review.created_at).toLocaleString("en-IE")}`,
    ),
  );
  const contact = element(
    "p",
    "",
    review.customer_email
      ? "Private follow-up email: " + review.customer_email
      : "No follow-up email supplied.",
  );
  form.append(
    contact,
    element("h3", "", "Original customer review"),
    element("div", "admin-original", review.review_text),
  );
  if (review.service_category)
    form.append(
      element(
        "p",
        "",
        "Service: " +
          (session.categories.find((c) => c.id === review.service_category)
            ?.name || review.service_category),
      ),
    );
  form.append(
    element(
      "small",
      "",
      `Review consent: ${review.consent_version}, ${new Date(review.consent_timestamp).toLocaleString("en-IE")}. Photo consent: ${review.photo_consent ? "recorded" : "not supplied"}.`,
    ),
  );
  field(form, "Publication status", "status", review.status, {
    options: [
      ["pending", "Pending"],
      ["approved", "Approved"],
      ["rejected", "Rejected"],
      ["hidden", "Hidden"],
    ],
  });
  field(
    form,
    "Associated existing project (optional)",
    "project",
    review.linked_project_id,
    {
      options: [
        ["", "No project association"],
        ...session.projects.map((p) => [p.id, p.title]),
      ],
    },
  );
  field(
    form,
    "Internal moderation notes (private)",
    "notes",
    review.moderation_notes,
    { type: "textarea" },
  ).maxLength = 2000;
  const retention = element("fieldset");
  retention.append(element("legend", "", "Retention and publication review"));
  const holdLabel = element("label", "review-check"),
    holdInput = element("input");
  holdInput.type = "checkbox";
  holdInput.name = "retentionHold";
  holdInput.checked = review.retention_hold === 1;
  holdLabel.append(
    holdInput,
    element(
      "span",
      "",
      "Keep private records for an active dispute or investigation",
    ),
  );
  retention.append(holdLabel);
  field(
    retention,
    "Reason for retention hold (private; required when checked)",
    "retentionHoldReason",
    review.retention_hold_reason,
    { type: "textarea", rows: 2 },
  ).maxLength = 500;
  retention.append(
    element(
      "small",
      "",
      "Saving an approved review confirms publication remains justified and sets a 90-day review reminder. Holds do not automatically expire; reassess and release them when the dispute or investigation ends.",
    ),
  );
  if (review.publication_review_due_at)
    retention.append(
      element(
        "p",
        "",
        "Publication review due: " +
          new Date(review.publication_review_due_at).toLocaleDateString(
            "en-IE",
          ),
      ),
    );
  form.append(retention);
  const privacy = element("details");
  privacy.append(
    element("summary", "", "Privacy or safety edits (preserve the original)"),
  );
  field(
    privacy,
    "Public display name override (optional)",
    "publicName",
    review.public_name,
  ).maxLength = 100;
  field(
    privacy,
    "Public text override (optional)",
    "publicText",
    review.public_text,
    { type: "textarea" },
  ).maxLength = 2000;
  field(
    privacy,
    "Reason for public edit (required when an override is used)",
    "redactionReason",
    review.redaction_reason,
  ).maxLength = 300;
  form.append(privacy);
  form.append(element("h3", "", "Photographs"));
  const photoList = element("div");
  photoList.id = "admin-photos";
  form.append(photoList);
  renderImages(photoList);
  if (session.photosEnabled) {
    const add = element("fieldset");
    add.append(
      element("legend", "", "Add business photographs (10 total maximum)"),
    );
    const permission = element("label", "review-check"),
      check = element("input");
    check.type = "checkbox";
    check.id = "business-photo-permission";
    permission.append(
      check,
      element(
        "span",
        "",
        "I own these photographs or have permission to publish them with this review.",
      ),
    );
    const upload = element("input");
    upload.type = "file";
    upload.accept = "image/jpeg,image/png,image/webp";
    upload.multiple = true;
    upload.setAttribute("aria-label", "Add business photographs");
    add.append(
      permission,
      upload,
      element(
        "small",
        "",
        "Save current edits before uploading. New photographs remain pending until individually approved.",
      ),
    );
    upload.onchange = async () => {
      const selected = Array.from(upload.files);
      if (!selected.length) return;
      if (!check.checked) {
        status.textContent = "Confirm photograph publication permission first.";
        upload.value = "";
        return;
      }
      if (
        images.filter((i) => i.status !== "removed").length + selected.length >
          10 ||
        selected.some(
          (f) =>
            f.size > 10 * 1024 * 1024 ||
            !["image/jpeg", "image/png", "image/webp"].includes(f.type),
        )
      ) {
        status.textContent =
          "Use up to 10 total JPEG, PNG or WebP photographs, no larger than 10 MB each.";
        upload.value = "";
        return;
      }
      try {
        await save(form, false);
        busy = true;
        setDisabled(form, true);
        for (const [at, file] of selected.entries()) {
          status.textContent = `Uploading business photograph ${at + 1} of ${selected.length}…`;
          await api(`/${review.id}/photos/${crypto.randomUUID()}`, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
              "X-Photo-Permission": session.consentVersion,
            },
            body: file,
          });
        }
        busy = false;
        await select(review.id);
        status.textContent =
          "Photographs added privately. Approve them and save when ready.";
      } catch (error) {
        busy = false;
        status.textContent = error.message;
        setDisabled(form, false);
      } finally {
        upload.value = "";
      }
    };
    form.append(add);
  }
  form.append(
    element(
      "p",
      "",
      `Owner notification: ${notification?.state || "not queued"}${notification?.last_error ? " — " + notification.last_error : ""}`,
    ),
  );
  const actions = element("div", "admin-actions"),
    saveButton = element("button", "btn btn-primary", "Save moderation"),
    preview = element(
      "button",
      "btn btn-outline-dark",
      "Preview public appearance",
    );
  saveButton.type = "submit";
  preview.type = "button";
  preview.onclick = () => previewReview(form);
  actions.append(saveButton, preview);
  form.append(actions);
  const audit = element("details", "admin-audit");
  audit.append(element("summary", "", "Moderation audit trail"));
  for (const entry of events)
    audit.append(
      element(
        "p",
        "",
        `${new Date(entry.created_at).toLocaleString("en-IE")} · ${entry.actor} · ${entry.action}${entry.notes ? " · " + entry.notes : ""}`,
      ),
    );
  const changes = element("details", "admin-audit");
  changes.append(element("summary", "", "Recorded change details"));
  for (const entry of events)
    if (entry.details_json && entry.details_json !== "{}")
      changes.append(element("pre", "admin-original", entry.details_json));
  audit.append(changes);
  form.append(audit);
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await save(form);
      await load();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  detail.append(form);
}
function setDisabled(form, value) {
  for (const control of form.querySelectorAll("input,button,textarea,select"))
    control.disabled = value;
}
function renderImages(container) {
  container.replaceChildren();
  for (const [at, image] of images.entries()) {
    if (image.status === "removed") {
      const retry = element("p", "admin-image", "Photograph hidden; physical deletion needs retry. Save moderation to retry deletion.");
      container.append(retry);
      continue;
    }
    const box = element("div", "admin-image"),
      preview = element("button");
    preview.type = "button";
    preview.setAttribute("aria-label", "Preview photograph " + (at + 1));
    const thumbnail = element("img");
    thumbnail.src = `/api/reviews/admin/images/${image.id}/480`;
    thumbnail.alt = image.caption || "Private work photograph";
    preview.append(thumbnail);
    preview.onclick = () =>
      openGallery(
        images
          .filter((i) => i.upload_state === "ready")
          .map((i) => ({
            ...i,
            full: `/api/reviews/admin/images/${i.id}/1600`,
          })),
        Math.max(
          0,
          images
            .filter((i) => i.upload_state === "ready")
            .findIndex((i) => i.id === image.id),
        ),
        preview,
      );
    box.append(preview);
    const controls = element("div");
    controls.append(
      element(
        "p",
        "",
        `${image.source === "business" ? "Business-added" : "Customer-submitted"} · ${image.upload_state === "ready" ? "processed" : "processing"} · permission recorded`,
      ),
    );
    const caption = field(
      controls,
      "Caption",
      "caption-" + image.id,
      image.caption,
    );
    caption.maxLength = 200;
    caption.oninput = () => (image.caption = caption.value);
    const state = field(
      controls,
      "Photo publication",
      "photo-" + image.id,
      image.status,
      {
        options: [
          ["pending", "Pending"],
          ["approved", "Approved"],
          ["removed", "Remove photograph"],
        ],
      },
    );
    state.onchange = () => (image.status = state.value);
    const order = element("div", "admin-image-controls");
    for (const [label, direction] of [
      ["Move up", -1],
      ["Move down", 1],
    ]) {
      const button = element("button", "", label);
      button.type = "button";
      button.disabled = at + direction < 0 || at + direction >= images.length;
      button.onclick = () => {
        [images[at], images[at + direction]] = [
          images[at + direction],
          images[at],
        ];
        renderImages(container);
      };
      order.append(button);
    }
    controls.append(order);
    box.append(controls);
    container.append(box);
  }
}
async function save(form, rerender = true) {
  if (busy) throw Error("Wait for the current operation.");
  const data = Object.fromEntries(new FormData(form));
  busy = true;
  setDisabled(form, true);
  status.textContent = "Saving moderation…";
  try {
    current = await api("/" + current.review.id, {
      method: "POST",
      body: JSON.stringify({
        ...data,
        retentionHold: form.elements.retentionHold.checked,
        version: current.review.version,
        images: images.map((i) => ({
          id: i.id,
          caption: i.caption,
          status: i.status,
        })),
      }),
    });
    images = current.images.map((i) => ({ ...i, status: i.approval_status }));
    if (rerender) render();
    status.textContent = "Moderation saved.";
  } finally {
    busy = false;
    setDisabled(form, false);
  }
}
function previewReview(form) {
  const values = Object.fromEntries(new FormData(form)),
    review = current.review,
    dialog = element("dialog", "review-preview-dialog");
  dialog.setAttribute("aria-label", "Public review preview");
  const close = element("button", "btn btn-outline-dark", "Close preview");
  close.type = "button";
  close.onclick = () => dialog.close();
  dialog.append(
    close,
    element(
      "p",
      "",
      "Preview only. Nothing is published until moderation is saved.",
    ),
  );
  dialog.append(
    renderCard({
      id: review.id,
      name: values.publicName || review.customer_name,
      text: values.publicText || review.review_text,
      edited: Boolean(values.publicName || values.publicText),
      rating: review.rating,
      date: review.published_at || Date.now(),
      category: review.service_category,
      images: images
        .filter((i) => i.status === "approved")
        .map((i) => ({
          ...i,
          thumbnail: `/api/reviews/admin/images/${i.id}/480`,
          full: `/api/reviews/admin/images/${i.id}/1600`,
        })),
    }),
  );
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
  close.focus();
}
filter.onchange = () => load();
document.querySelector("#admin-refresh").onclick = () => load();
more.onclick = () => load(false);
try {
  session = await api("/session");
  await load();
  status.textContent = "Owner access verified.";
} catch (error) {
  status.textContent = error.message;
  filter.disabled = true;
}
