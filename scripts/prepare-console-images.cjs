const fs = require("node:fs/promises"),
  path = require("node:path"),
  sharp = require("sharp");
// Explicit source directory required. Only these four supplied photos are processed.
(async () => {
  const sourceDir = process.argv[2];
  if (!sourceDir)
    throw Error(
      "Usage: node scripts/prepare-console-images.cjs <original-photo-directory>",
    );
  const dir = path.join(__dirname, "../assets/projects/wayfair-console-table");
  await fs.mkdir(dir, { recursive: true });
  for (const n of [1, 2, 3, 4]) {
    const source = path.join(sourceDir, `Consol_table_${n}.png`),
      m = await sharp(source).metadata();
    // Re-encode losslessly to remove every ancillary metadata block, not just EXIF.
    await sharp(source)
      .rotate()
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, `Consol_table_${n}.png`));
    for (const width of [480, 800, 1600])
      await sharp(source)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(dir, `console-table-${n}-${width}.webp`));
    console.log(`Prepared photo ${n}: ${m.width}x${m.height}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
