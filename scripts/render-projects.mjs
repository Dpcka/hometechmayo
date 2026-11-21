import { readFileSync, writeFileSync } from "node:fs";
import { PROJECTS } from "../js/project-data.mjs";
import { fileURLToPath } from "node:url";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderTestimonial(testimonial, full = false) {
  if (!testimonial) return "";
  const text = full && testimonial.fullText ? testimonial.fullText : testimonial.text;
  const rating = Number.isInteger(testimonial.rating) && testimonial.rating >= 1 && testimonial.rating <= 5
    ? `<span aria-label="${testimonial.rating} out of 5 stars">${"★".repeat(testimonial.rating)}</span> · ` : "";
  const source = testimonial.url
    ? `<a href="${escape(testimonial.url)}" target="_blank" rel="noopener noreferrer">${escape(testimonial.source)} review</a>`
    : escape(testimonial.source);
  return `<figure class="project-testimonial"><blockquote>${text.split("\n\n").map(p => `<p>${escape(p)}</p>`).join("")}</blockquote><figcaption>${rating}${escape(testimonial.author)}, ${escape(testimonial.location)} · ${source}</figcaption></figure>`;
}
export function renderProjectCards() {
  return PROJECTS.map((project) => {
    const image = project.images[0];
    const workDetails = [project.extendedDescription, project.result].filter(
      Boolean,
    ).flatMap((text) => text.split("\n\n"));
    const completion = project.completionDate
      ? `<p class="project-meta">Completed: <time datetime="${escape(project.completionDate)}">${new Intl.DateTimeFormat("en-IE", { ...(project.completionDate.length > 7 ? {day:"numeric"} : {}), month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(project.completionDate + (project.completionDate.length === 7 ? "-01" : "") + "T00:00:00Z"))}</time></p>`
      : "";
    return `            <article class="project-card" data-project-id="${project.id}" id="project-${project.id}"${project.websiteReviewAssociation === false ? ' data-website-review-association="disabled"' : ""}>
              <div class="project-photo">
                <a class="project-photo-open" href="${image.full}" aria-label="View photos: ${escape(project.title)}">
                  <img src="${image.src}" srcset="${image.srcset}" sizes="(max-width: 650px) 90vw, (max-width: 1100px) 45vw, 360px" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}" style="object-position:${image.position}" loading="lazy" decoding="async" />
                </a>
              </div>
              <div class="project-content">
                <h3>${project.detailUrl ? `<a href="${escape(project.detailUrl)}">${escape(project.title)}</a>` : escape(project.title)}</h3>
                ${project.category ? `<p class="project-meta">${project.category === "Furniture Assembly" ? '<a href="/services/furniture-assembly">Furniture Assembly</a>' : escape(project.category)}${project.location ? ` · ${escape(project.location)}` : ""}</p>` : ""}
                ${completion}
                <p>${escape(project.description)}</p>
                ${renderTestimonial(project.testimonial)}
                <div class="project-actions">
                  <a class="project-service-link" href="${escape(project.relatedService || "/quote")}">Request a Similar Service</a>
                  ${workDetails.length ? `<details class="project-work-details"><summary>Work details</summary>${workDetails.map((detail) => `<p>${escape(detail)}</p>`).join("")}</details>` : ""}
                </div>
              </div>
            </article>`;
  })
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n");
}
export function renderProjectMetadata() {
  const metadata = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: "Home Tech completed projects", numberOfItems: PROJECTS.length,
    itemListElement: PROJECTS.map((project, index) => ({
      "@type": "ListItem", position: index + 1,
      item: {
        "@type": "CreativeWork", name: project.title,
        url: `https://hometechmayo.ie/${project.detailUrl ? project.detailUrl.slice(1) : `#project-${project.id}`}`,
        description: [project.description, project.extendedDescription, project.result].filter(Boolean).join("\n\n"),
        image: project.images.map(image => `https://hometechmayo.ie/${image.full}`),
        ...(project.location ? { contentLocation: { "@type": "Place", name: project.location } } : {}),
      },
    })),
  };
  return `          <script type="application/ld+json" id="project-portfolio-data">${JSON.stringify(metadata).replace(/</g, "\\u003c")}</script>`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
const path = new URL("../index.html", import.meta.url);
const html = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const start = "          <!-- PROJECT CARDS START -->",
  end = "          <!-- PROJECT CARDS END -->";
const rendered = `${start}\n${renderProjectCards()}\n${renderProjectMetadata()}\n${end}`;
if (!html.includes(start) || !html.includes(end))
  throw Error("Project markers missing");
if (process.argv.includes("--check")) {
  if (!html.includes(rendered)) throw Error("Project cards need regeneration");
  console.log("Project cards match data");
} else
  writeFileSync(
    path,
    html.replace(
      /          <!-- PROJECT CARDS START -->[\s\S]*?          <!-- PROJECT CARDS END -->/,
      rendered,
    ),
  );
}
