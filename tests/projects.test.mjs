import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { PROJECTS } from "../js/project-data.mjs";
test("project catalogue uses stable unique IDs, keeps the two existing projects and console photo order", () => {
  assert.equal(PROJECTS.length, 4);
  assert.equal(new Set(PROJECTS.map((p) => p.id)).size, 4);
  assert.deepEqual(
    PROJECTS.map((p) => p.title),
    [
      "Bathroom Ventilation Upgrade",
      "Furniture Assembly",
      "Wayfair Console Table Assembly",
      "Complete Furniture Assembly – Two Residential Properties in Westport",
    ],
  );
  assert.deepEqual(
    PROJECTS[2].images.map((i) => Number(i.src.match(/console-table-(\d)/)[1])),
    [1, 3, 2, 4],
  );
  assert.equal(PROJECTS[1].images.length, 1);
  assert.equal(PROJECTS[2].relatedService, "pricing.html#pricing-furniture");
  for (const p of PROJECTS)
    for (const image of p.images) {
      assert.ok(image.alt && image.width && image.height);
      assert.ok(existsSync(image.src));
      assert.ok(existsSync(image.full));
    }
  execFileSync(process.execPath, ["scripts/render-projects.mjs", "--check"]);
});
test("all responsive images exist with correct advertised widths and no embedded private metadata", async () => {
  for (const p of PROJECTS)
    for (const image of p.images) {
      for (const source of image.srcset.split(", ")) {
        const [file, width] = source.split(" "),
          meta = await sharp(file).metadata();
        assert.equal(meta.width, Number(width.slice(0, -1)));
        assert.equal(meta.exif, undefined);
        assert.equal(meta.xmp, undefined);
        assert.equal(meta.iptc, undefined);
      }
    }
});
test("console source copies and optimized variants preserve source proportions and metadata privacy", async () => {
  for (const n of [1, 2, 3, 4]) {
    const source = `assets/projects/wayfair-console-table/Consol_table_${n}.png`;
    const meta = await sharp(source).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.equal(meta.iptc, undefined);
    const png = readFileSync(source);
    let offset = 8;
    while (offset + 12 <= png.length) {
      const length = png.readUInt32BE(offset),
        type = png.toString("ascii", offset + 4, offset + 8);
      assert.ok(
        ["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "pHYs"].includes(type),
        `Unexpected metadata chunk ${type}`,
      );
      offset += length + 12;
    }
    for (const width of [480, 800, 1600]) {
      const file = `assets/projects/wayfair-console-table/console-table-${n}-${width}.webp`;
      const m = await sharp(file).metadata();
      assert.equal(m.width, Math.min(width, meta.width));
      assert.ok(
        Math.abs(m.width / m.height - meta.width / meta.height) < 0.002,
      );
      assert.ok(readFileSync(file).length < 250000);
    }
  }
});

test("every project uses shared actions, valid service links, and only verified optional work details", () => {
  const html = readFileSync("index.html", "utf8"),
    pricing = readFileSync("pricing.html", "utf8");
  assert.deepEqual(
    PROJECTS.map((p) => p.relatedService),
    [
      "pricing.html#pricing-ventilation",
      "pricing.html#pricing-furniture",
      "pricing.html#pricing-furniture",
      "pricing.html#pricing-furniture",
    ],
  );
  for (const project of PROJECTS) {
    const card = html.match(
      new RegExp(
        `<article class="project-card" data-project-id="${project.id}"[^>]*>[\\s\\S]*?<\\/article>`,
      ),
    )[0];
    assert.equal((card.match(/class="project-actions"/g) || []).length, 1);
    assert.ok(card.includes(`href="${project.relatedService}"`));
    assert.equal(
      card.includes('class="project-work-details"'),
      Boolean(project.extendedDescription || project.result),
    );
    assert.ok(pricing.includes(`id="${project.relatedService.split("#")[1]}"`));
  }
  assert.equal(PROJECTS[0].extendedDescription, undefined);
  assert.equal(PROJECTS[1].extendedDescription, undefined);
});

test("Westport is one 11-photo project with approved details, separate Bark attribution and search metadata", () => {
  const project = PROJECTS.find(p => p.id === "westport-furniture-assembly");
  const html = readFileSync("index.html", "utf8");
  assert.equal(project.images.length, 11);
  assert.equal(project.completionDate, "2026-11");
  assert.equal(project.location, "Westport, Co. Mayo, Ireland");
  assert.match(project.images[0].src, /living-room-overview/);
  assert.match(project.extendedDescription, /14 furniture items from JYSK/);
  assert.match(project.extendedDescription, /two days/);
  assert.equal(project.testimonial.author, "Finbar");
  assert.equal(project.testimonial.source, "Bark");
  assert.equal(project.testimonial.rating, 5);
  assert.equal(project.websiteReviewAssociation, false);
  assert.equal((html.match(/data-project-id="westport-furniture-assembly"/g) || []).length, 1);
  assert.ok(html.includes('id="project-westport-furniture-assembly"'));
  assert.ok(html.includes('<time datetime="2026-11">November 2026</time>'));
  const metadata = JSON.parse(html.match(/id="project-portfolio-data">(.*?)<\/script>/s)[1]);
  const item = metadata.itemListElement.find(i => i.item.name === project.title).item;
  assert.equal(item.image.length, 11);
  assert.equal(item.url, "https://hometechmayo.ie/#project-westport-furniture-assembly");
  assert.equal(item.aggregateRating, undefined);
});

test("adding the Westport portfolio does not expand existing Reviews database associations", async () => {
  const { PROJECT_OPTIONS } = await import("../server/reviews/policy.mjs");
  assert.deepEqual(PROJECT_OPTIONS.map(p => p.id), ["bathroom-ventilation", "furniture-assembly", "wayfair-console-table"]);
});
