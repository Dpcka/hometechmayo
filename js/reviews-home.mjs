import { renderCard } from "./reviews-ui.mjs";
const section = document.querySelector("#website-customer-reviews");
if (section) {
  try {
    const response = await fetch("/api/reviews?limit=3");
    if (response.ok) {
      const { reviews } = await response.json();
      const grid = section.querySelector(".website-reviews-grid");
      for (const review of reviews)
        grid.append(renderCard(review, { compact: true }));
      section.hidden = false;
      section.querySelector("[data-review-empty]").hidden = reviews.length > 0;
    }
  } catch {
    /* No substitute reviews or claims when the API is unavailable. */
  }
}
// Explicit project associations only. Existing card photographs/carousels are untouched.
const cards = document.querySelectorAll("[data-project-id]");
for (const card of cards) {
  const id = card.dataset.projectId;
  if (!id) continue;
  try {
    const response = await fetch(
      "/api/reviews?limit=1&project=" + encodeURIComponent(id),
    );
    if (!response.ok) continue;
    const { reviews } = await response.json();
    if (reviews[0]) {
      const link = document.createElement("a");
      link.className = "project-website-review";
      link.href = "/reviews#review-" + reviews[0].id;
      link.textContent = "Read the customer’s website review";
      card.append(link);
    }
  } catch {
    /* Association is optional. */
  }
}
