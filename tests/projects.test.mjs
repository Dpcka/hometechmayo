import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { PROJECTS } from "../js/project-data.mjs";
test("project catalogue uses stable unique IDs, keeps the two existing projects and console photo order", () => {
  assert.equal(PROJECTS.length, 3);
  assert.equal(new Set(PROJECTS.map((p) => p.id)).size, 3);
  assert.deepEqual(
    PROJECTS.map((p) => p.title),
    [
      "Bathroom Ventilation Upgrade",
      "Furniture Assembly",
      "Wayfair Console Table Assembly",
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
