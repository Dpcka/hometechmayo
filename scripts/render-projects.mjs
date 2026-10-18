import { readFileSync, writeFileSync } from "node:fs";
import { PROJECTS } from "../js/project-data.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderProjectCards() {
  return PROJECTS.map((project) => {
    const image = project.images[0];
    return `            <article class="project-card" data-project-id="${project.id}">
              <div class="project-photo">
                <a class="project-photo-open" href="${image.full}" aria-label="View photos: ${escape(project.title)}">
                  <img src="${image.src}" srcset="${image.srcset}" sizes="(max-width: 650px) 90vw, (max-width: 1100px) 45vw, 360px" alt="${escape(image.alt)}" width="${image.width}" height="${image.height}" style="object-position:${image.position}" loading="lazy" decoding="async" />
                </a>
              </div>
              <div class="project-content">
                <h3>${escape(project.title)}</h3>
                ${project.location ? `<p class="project-meta">${escape(project.category)} · ${escape(project.location)}</p>` : ""}
                <p>${escape(project.description)}</p>
                ${project.extendedDescription ? `<details class="project-work-details"><summary>Work details</summary><p>${escape(project.extendedDescription)}</p><p>${escape(project.result)}</p></details>` : ""}
                ${project.relatedService ? `<a class="project-service-link" href="${project.relatedService}">Request a Similar Service</a>` : ""}
              </div>
            </article>`;
  })
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n");
}
const path = new URL("../index.html", import.meta.url);
const html = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const start = "          <!-- PROJECT CARDS START -->",
  end = "          <!-- PROJECT CARDS END -->";
const rendered = `${start}\n${renderProjectCards()}\n${end}`;
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
