const fs = require("node:fs/promises"), path = require("node:path"), sharp = require("sharp");
// Process only the owner's edited archive photos. Originals are never overwritten.
const photos = [
  ["Living_Room/Living_Room_01.jpg", "westport-jysk-living-room-overview", "Completed living room in Westport with assembled JYSK TV unit and coffee table"],
  ["Living_Room/Living_Room_04.jpg", "westport-jysk-tv-unit-coffee-table", "Assembled JYSK TV unit and coffee table positioned beside the living-room sofa"],
  ["Living_Room/Living_Room_02.jpg", "westport-jysk-coffee-table-sofa", "Wooden JYSK coffee table assembled and positioned in front of the sofa"],
  ["Living_Room/Living_Room_03.jpg", "westport-jysk-tv-unit-storage", "Completed wooden JYSK TV unit with drawers and open storage"],
  ["Dining_Room/Dining_Room_02.jpg", "westport-jysk-dining-area", "Completed dining area with assembled wooden table and chairs in Westport"],
  ["Dining_Room/Dining_Room_01.jpg", "westport-jysk-dining-table-chairs", "Assembled JYSK dining table with upholstered dining chairs"],
  ["Dining_Room/Dining_Room_03.jpg", "westport-jysk-dining-table-leg-detail", "Dining table leg and frame detail after furniture assembly"],
  ["Dining_Room/Dining_Room_04.jpg", "westport-jysk-second-dining-table", "Second assembled dining table positioned beside the stone fireplace"],
  ["Bedroom/Bedroom_03.jpg", "westport-jysk-bedroom-wardrobe", "Completed bedroom with assembled white JYSK wardrobe beside the bed"],
  ["Bedroom/Bedroom_01.jpg", "westport-jysk-white-wardrobe", "Assembled white wardrobe with wooden top and lower drawers"],
  ["Bedroom/Bedroom_02.jpg", "westport-jysk-wardrobe-positioned", "White wardrobe positioned in a bedroom after assembly and alignment"],
];
(async () => {
  if (!process.argv[2]) throw Error("Usage: node scripts/prepare-westport-images.cjs <extracted-edited-photo-directory>");
  const output = path.join(__dirname, "../assets/projects/westport-furniture-assembly");
  await fs.mkdir(output, { recursive: true });
  const manifest = []; let sourceBytes = 0, outputBytes = 0;
  for (const [original, name, alt] of photos) {
    const source = path.join(process.argv[2], original);
    const metadata = await sharp(source).metadata();
    if (metadata.orientation && metadata.orientation !== 1) throw Error("Inspect orientation before processing " + original);
    sourceBytes += (await fs.stat(source)).size;
    const widths = [...new Set([480, 800, Math.min(1600, metadata.width)])];
    for (const width of widths) {
      const file = path.join(output, `${name}-${width}.webp`);
      await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(file);
      outputBytes += (await fs.stat(file)).size;
    }
    const prefix = `assets/projects/westport-furniture-assembly/${name}`;
    manifest.push({ src: `${prefix}-800.webp`, srcset: widths.map(w => `${prefix}-${w}.webp ${w}w`).join(", "), full: `${prefix}-${widths.at(-1)}.webp`, alt, width: metadata.width, height: metadata.height, position: "center" });
  }
  await fs.writeFile(path.join(output, "images.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ photographs: photos.length, variants: photos.length * 3, sourceBytes, outputBytes }));
})().catch(error => { console.error(error.message); process.exit(1); });
