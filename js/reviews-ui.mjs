// Review galleries reuse the existing project-viewer styling and native dialog pattern.
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const date = (value) =>
  new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(
    new Date(value),
  );
let viewer,
  items = [],
  index = 0,
  returnFocus;
function ensureViewer() {
  if (viewer) return;
  viewer = element("dialog", "project-viewer review-viewer");
  viewer.setAttribute("aria-label", "Review photographs");
  const panel = element("div", "project-viewer-panel"),
    head = element("div", "project-viewer-header");
  head.append(element("h2", "", "Review photographs"));
  const close = element("button", "", "Close ×");
  close.type = "button";
  close.addEventListener("click", () => viewer.close());
  head.append(close);
  const stage = element("div", "project-viewer-stage"),
    image = element("img");
  image.alt = "";
  image.draggable = false;
  stage.append(image);
  image.addEventListener("error", () => {
    viewer.querySelector(".project-viewer-caption").textContent =
      "This photograph could not load. Try another photo or close the viewer.";
  });
  const nav = element("div", "project-viewer-navigation"),
    prev = element("button", "", "←"),
    next = element("button", "", "→"),
    caption = element("p", "project-viewer-caption");
  prev.type = next.type = "button";
  prev.setAttribute("aria-label", "Previous review photograph");
  next.setAttribute("aria-label", "Next review photograph");
  caption.setAttribute("aria-live", "polite");
  prev.onclick = () => show(index - 1);
  next.onclick = () => show(index + 1);
  nav.append(prev, caption, next);
  panel.append(head, stage, nav);
  viewer.append(panel);
  document.body.append(viewer);
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    }
  });
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener("close", () => {
    document.documentElement.classList.remove("project-viewer-open");
    returnFocus?.focus();
  });
  let start;
  stage.style.touchAction = "pan-y";
  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1)
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (e) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x,
        dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5)
        show(index + (dx < 0 ? 1 : -1));
      start = null;
    },
    { passive: true },
  );
}
function show(value) {
  index = (value + items.length) % items.length;
  const item = items[index],
    image = viewer.querySelector("img");
  image.src = item.full || item.url;
  image.alt = item.caption || "Photograph of completed work";
  viewer.querySelector(".project-viewer-caption").textContent =
    `${index + 1} of ${items.length}${item.caption ? " — " + item.caption : ""}`;
  for (const button of viewer
    .querySelector(".project-viewer-navigation")
    .querySelectorAll("button"))
    button.hidden = items.length < 2;
}
export function openGallery(images, at, trigger) {
  ensureViewer();
  items = images;
  returnFocus = trigger;
  show(at);
  viewer.showModal();
  document.documentElement.classList.add("project-viewer-open");
  viewer.querySelector("button").focus();
}
export function renderCard(review, { compact = false } = {}) {
  const card = element("article", "website-review-card");
  card.id = "review-" + review.id;
  const stars = element(
    "p",
    "website-review-stars",
    "★".repeat(review.rating) + "☆".repeat(5 - review.rating),
  );
  stars.setAttribute("role", "img");
  stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
  const name = element("h3", "", review.name),
    time = element("time", "", date(review.date));
  time.dateTime = new Date(review.date).toISOString();
  card.append(
    stars,
    name,
    time,
    element(
      "p",
      "website-review-text",
      compact && review.text.length > 220
        ? review.text.slice(0, 217) + "…"
        : review.text,
    ),
  );
  if (review.edited)
    card.append(
      element(
        "small",
        "",
        "Edited for privacy or safety; the original is retained privately.",
      ),
    );
  if (review.category)
    card.append(
      element(
        "p",
        "website-review-category",
        review.categoryLabel || review.category.replaceAll("-", " "),
      ),
    );
  if (review.images?.length) {
    const gallery = element("div", "review-thumbnails");
    for (const [at, item] of review.images
      .slice(0, compact ? 1 : 10)
      .entries()) {
      const button = element("button");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `View photograph ${at + 1}${item.caption ? ": " + item.caption : ""}`,
      );
      const image = element("img");
      image.src = item.thumbnail || item.url;
      image.alt = item.caption || "Completed work";
      image.width = 160;
      image.height = 120;
      image.loading = "lazy";
      image.decoding = "async";
      button.append(image);
      button.addEventListener("click", () =>
        openGallery(review.images, at, button),
      );
      gallery.append(button);
    }
    card.append(gallery);
  }
  card.append(element("small", "website-review-source", "Website Review"));
  if (compact) {
    const link = element("a", "", "Read full review");
    link.href = "/reviews#review-" + review.id;
    card.append(link);
  }
  return card;
}
