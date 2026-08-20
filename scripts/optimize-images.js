"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const assetsDirectory = path.resolve(__dirname, "..", "assets");
const maximumWidth = 1920;
const webpQuality = 82;
const supportedExtensions = new Set([".jpg", ".jpeg", ".png"]);
const excludedDirectories = new Set([
  "fonts",
  "icon",
  "icons",
  "favicon",
  "favicons",
  "logo",
  "logos"
]);

function toDisplayPath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function isExcluded(filePath) {
  const relativeParts = path.relative(assetsDirectory, filePath)
    .split(path.sep)
    .map(part => part.toLowerCase());
  const filename = relativeParts.at(-1);

  return (
    relativeParts.some(part => excludedDirectories.has(part)) ||
    filename.includes("favicon") ||
    filename.includes("logo") ||
    filename.includes("icon")
  );
}

async function findSourceImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name.toLowerCase())) {
        images.push(...await findSourceImages(entryPath));
      }

      continue;
    }

    if (!entry.isFile() || isExcluded(entryPath)) {
      continue;
    }

    if (supportedExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(entryPath);
    }
  }

  return images;
}

async function optimiseImage(sourcePath) {
  const parsedPath = path.parse(sourcePath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);
  const sourceStats = await fs.stat(sourcePath);

  try {
    const outputStats = await fs.stat(outputPath);

    if (outputStats.mtimeMs >= sourceStats.mtimeMs) {
      console.log(`Skipped: ${toDisplayPath(outputPath)} already up to date`);
      return "skipped";
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: maximumWidth,
      withoutEnlargement: true
    })
    .webp({ quality: webpQuality })
    .toFile(outputPath);

  console.log(
    `Optimized: ${toDisplayPath(sourcePath)} -> ${toDisplayPath(outputPath)}`
  );

  return "optimized";
}

async function main() {
  try {
    await fs.access(assetsDirectory);
  } catch {
    console.log("No assets directory found. Nothing to optimize.");
    return;
  }

  const sourceImages = await findSourceImages(assetsDirectory);

  if (sourceImages.length === 0) {
    console.log("No JPG, JPEG or PNG photos found to optimize.");
    return;
  }

  let optimizedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const sourcePath of sourceImages) {
    try {
      const result = await optimiseImage(sourcePath);

      if (result === "optimized") {
        optimizedCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      console.error(`Failed: ${toDisplayPath(sourcePath)} — ${error.message}`);
    }
  }

  console.log(
    `\nImage optimization complete: ${optimizedCount} optimized, ${skippedCount} skipped, ${failedCount} failed.`
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main();
