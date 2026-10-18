import { projectById } from "./project-data.mjs";
import { createAutoplay } from "./project-autoplay.mjs";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const autoplayClocks = [];
function pauseSlides(reason) {
  for (const clock of autoplayClocks) clock.pause(reason);
}
function resumeSlides(reason) {
  for (const clock of autoplayClocks) clock.resume(reason);
}
function syncEnvironment() {
  document.hidden ? pauseSlides("hidden") : resumeSlides("hidden");
  reducedMotion.matches ? pauseSlides("reduced") : resumeSlides("reduced");
}
document.addEventListener("visibilitychange", syncEnvironment);
reducedMotion.addEventListener("change", syncEnvironment);
export const wrapIndex = (index, count) => ((index % count) + count) % count;
const button = (label, text, className) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.setAttribute("aria-label", label);
  b.textContent = text;
  return b;
};
function watchImage(img, message) {
  const failed = () => {
    message.hidden = false;
    img.classList.add("project-image-failed");
  };
  img.addEventListener("error", failed);
  img.addEventListener("load", () => {
    message.hidden = true;
    img.classList.remove("project-image-failed");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      img.animate?.([{ opacity: 0.7 }, { opacity: 1 }], {
        duration: 140,
        easing: "ease-out",
      });
  });
  if (img.complete && !img.naturalWidth) failed();
}
// Horizontal-only gestures let the browser keep normal vertical page scrolling.
function swipe(surface, previous, next) {
  let start,
    suppressUntil = 0;
  surface.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.target.closest("button")) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  surface.addEventListener("pointercancel", () => {
    start = undefined;
  });
  surface.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    start = undefined;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressUntil = Date.now() + 400;
      dx < 0 ? next() : previous();
    }
  });
  surface.addEventListener(
    "click",
    (event) => {
      if (Date.now() < suppressUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}
const dialog = document.createElement("dialog");
dialog.className = "project-viewer";
dialog.setAttribute("aria-labelledby", "project-viewer-title");
dialog.innerHTML = `<div class="project-viewer-panel"><div class="project-viewer-header"><h2 id="project-viewer-title"></h2><button type="button" class="project-viewer-close" aria-label="Close photo viewer">Close ×</button></div><div class="project-viewer-stage"><img alt="" decoding="async" draggable="false"><p class="project-image-error" role="status" hidden>This photograph could not load. Try another photo or close the viewer.</p></div><div class="project-viewer-navigation"><button type="button" class="project-viewer-prev" aria-label="Previous project photo">←</button><p class="project-viewer-caption" aria-live="polite"></p><button type="button" class="project-viewer-next" aria-label="Next project photo">→</button></div></div>`;
document.body.append(dialog);
const fullImage = dialog.querySelector("img"),
  caption = dialog.querySelector(".project-viewer-caption"),
  prev = dialog.querySelector(".project-viewer-prev"),
  next = dialog.querySelector(".project-viewer-next");
watchImage(fullImage, dialog.querySelector(".project-image-error"));
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches)
    fullImage.getAnimations().forEach((animation) => animation.cancel());
});
let active, opener, oldOverflow;
function renderViewer() {
  const { project, index } = active,
    image = project.images[index];
  fullImage.classList.remove("project-image-failed");
  dialog.querySelector(".project-image-error").hidden = true;
  fullImage.alt = image.alt;
  fullImage.width = image.width;
  fullImage.height = image.height;
  fullImage.src = image.full;
  dialog.querySelector("h2").textContent = project.title;
  caption.textContent = `${project.images.length > 1 ? `${index + 1} / ${project.images.length} · ` : ""}${image.alt}`;
  prev.hidden = next.hidden = project.images.length < 2;
}
function move(delta) {
  if (!active) return;
  active.setIndex(
    wrapIndex(active.index + delta, active.project.images.length),
  );
  renderViewer();
}
prev.addEventListener("click", () => move(-1));
next.addEventListener("click", () => move(1));
dialog
  .querySelector(".project-viewer-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    const controls = [...dialog.querySelectorAll("button:not([hidden])")],
      first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }
});
dialog.addEventListener("close", () => {
  document.body.style.overflow = oldOverflow ?? "";
  document.documentElement.classList.remove("project-viewer-open");
  opener?.focus({ preventScroll: true });
  active = undefined;
  fullImage.removeAttribute("src");
  resumeSlides("viewer");
});
swipe(
  dialog.querySelector(".project-viewer-stage"),
  () => move(-1),
  () => move(1),
);
for (const [cardOrder, card] of [
  ...document.querySelectorAll("[data-project-id]"),
].entries()) {
  const project = projectById(card.dataset.projectId);
  if (!project) continue;
  const photo = card.querySelector(".project-photo"),
    link = card.querySelector(".project-photo-open"),
    image = link.querySelector("img");
  image.draggable = false;
  const error = document.createElement("p");
  error.className = "project-image-error";
  error.hidden = true;
  error.setAttribute("role", "status");
  error.textContent = "Photo unavailable. Use another photo if available.";
  photo.append(error);
  let index = 0,
    clock,
    previousLayer,
    fade,
    generation = 0;
  const dots = [];
  const clearFade = () => {
    fade?.cancel();
    fade = undefined;
    previousLayer?.remove();
    previousLayer = undefined;
  };
  image.addEventListener("error", () => {
    clearFade();
    error.hidden = false;
    image.classList.add("project-image-failed");
  });
  image.addEventListener("load", async () => {
    const current = generation;
    try {
      await image.decode();
    } catch {
      return;
    }
    if (current !== generation) return;
    error.hidden = true;
    image.classList.remove("project-image-failed");
    if (!previousLayer) return;
    if (reducedMotion.matches) {
      clearFade();
      return;
    }
    const layer = previousLayer;
    fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 500,
      easing: "ease-in-out",
      fill: "forwards",
    });
    fade.finished
      .then(() => {
        if (current === generation && layer === previousLayer) clearFade();
      })
      .catch(() => {});
  });
  if (image.complete && !image.naturalWidth) {
    error.hidden = false;
    image.classList.add("project-image-failed");
  }
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) clearFade();
  });
  const state = {
    project,
    index: 0,
    setIndex(value, { automatic = false } = {}) {
      const nextIndex = wrapIndex(value, project.images.length);
      if (nextIndex === index) return;
      if (!automatic) clock?.restart();
      generation++;
      // An interrupted transition must retain the old pixels until the latest
      // requested asset is ready, even on a slow connection.
      fade?.cancel();
      fade = undefined;
      // Hold the already-displayed asset until the requested one has decoded.
      // No other future image is prefetched. One overlay produces a true crossfade.
      if (
        !reducedMotion.matches &&
        image.complete &&
        image.naturalWidth &&
        !previousLayer
      ) {
        previousLayer = image.cloneNode(false);
        previousLayer.className = "project-photo-previous";
        previousLayer.alt = "";
        previousLayer.setAttribute("aria-hidden", "true");
        previousLayer.removeAttribute("srcset");
        previousLayer.removeAttribute("sizes");
        previousLayer.src = image.currentSrc || image.src;
        previousLayer.loading = "eager";
        link.append(previousLayer);
      } else if (reducedMotion.matches) clearFade();
      index = state.index = nextIndex;
      const item = project.images[index];
      image.classList.remove("project-image-failed");
      error.hidden = true;
      image.alt = item.alt;
      image.width = item.width;
      image.height = item.height;
      image.style.objectPosition = item.position || "center";
      image.srcset = item.srcset;
      image.src = item.src;
      link.href = item.full;
      link.setAttribute(
        "aria-label",
        `View photos: ${project.title}, photo ${index + 1} of ${project.images.length}`,
      );
      dots.forEach((dot, i) => {
        if (i === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
    },
  };
  if (project.images.length > 1) {
    photo.setAttribute("role", "group");
    photo.setAttribute("aria-roledescription", "carousel");
    photo.setAttribute("aria-label", project.title);
    const pagination = document.createElement("div");
    pagination.className = "project-photo-dots";
    pagination.setAttribute("role", "group");
    pagination.setAttribute("aria-label", `Choose photo: ${project.title}`);
    project.images.forEach((item, i) => {
      const dot = button(
        `Show photo ${i + 1} of ${project.images.length}: ${project.title}`,
        "",
        "project-photo-dot",
      );
      if (i === 0) dot.setAttribute("aria-current", "true");
      dot.addEventListener("click", () => state.setIndex(i));
      dot.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const target = wrapIndex(
            i + (event.key === "ArrowRight" ? 1 : -1),
            dots.length,
          );
          dots[target].focus();
          state.setIndex(target);
        }
      });
      dots.push(dot);
      pagination.append(dot);
    });
    photo.append(pagination);
    clock = createAutoplay({
      stagger: cardOrder * 850,
      advance: () => {
        // Check current preferences too: change events may be queued behind a timer.
        if (document.hidden || reducedMotion.matches) {
          syncEnvironment();
          return;
        }
        state.setIndex(index + 1, { automatic: true });
      },
    });
    autoplayClocks.push(clock);
    if (document.hidden) clock.pause("hidden");
    if (reducedMotion.matches) clock.pause("reduced");
    if (matchMedia("(hover: hover)").matches && card.matches(":hover"))
      clock.pause("hover");
    if (photo.contains(document.activeElement)) clock.pause("focus");
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") clock.pause("hover");
    });
    card.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") clock.resume("hover");
    });
    photo.addEventListener("focusin", () => clock.pause("focus"));
    photo.addEventListener("focusout", () =>
      queueMicrotask(() => {
        if (!photo.contains(document.activeElement)) clock.resume("focus");
      }),
    );
    card.addEventListener("pointerdown", () => clock.pause("interaction"));
    document.addEventListener("pointerup", () => clock.resume("interaction"));
    document.addEventListener("pointercancel", () =>
      clock.resume("interaction"),
    );
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            entry.isIntersecting
              ? clock.resume("offscreen")
              : clock.pause("offscreen");
        },
        { threshold: 0.1 },
      );
      observer.observe(card);
    } else clock.resume("offscreen");
    swipe(
      link,
      () => state.setIndex(index - 1),
      () => state.setIndex(index + 1),
    );
  }
  link.addEventListener("click", (event) => {
    if (typeof dialog.showModal !== "function") return;
    event.preventDefault();
    pauseSlides("viewer");
    opener = link;
    active = state;
    oldOverflow = document.body.style.overflow;
    renderViewer();
    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("project-viewer-open");
    dialog.querySelector(".project-viewer-close").focus();
  });
}
