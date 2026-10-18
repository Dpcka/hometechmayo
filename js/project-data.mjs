// Source of truth for project cards. Run node scripts/render-projects.mjs after edits.
const existingImage = (name, alt, width, height, position = "center") => ({
  src: `assets/projects/${name}-800.webp`,
  srcset: `assets/projects/${name}-800.webp 800w, assets/projects/${name}-1600.webp 1600w`,
  full: `assets/projects/${name}-1600.webp`,
  alt,
  width,
  height,
  position,
});
const consoleImage = (number, alt, portrait = false) => ({
  src: `assets/projects/wayfair-console-table/console-table-${number}-800.webp`,
  srcset: `assets/projects/wayfair-console-table/console-table-${number}-480.webp 480w, assets/projects/wayfair-console-table/console-table-${number}-800.webp 800w, assets/projects/wayfair-console-table/console-table-${number}-1600.webp ${portrait ? 941 : 1600}w`,
  full: `assets/projects/wayfair-console-table/console-table-${number}-1600.webp`,
  alt,
  width: portrait ? 941 : 1672,
  height: portrait ? 1672 : 941,
  position: portrait ? "center 65%" : "center 65%",
});
export const PROJECTS = [
  {
    id: "bathroom-ventilation",
    relatedService: "pricing.html#pricing-ventilation",
    title: "Bathroom Ventilation Upgrade",
    category: "Ventilation",
    description:
      "Complete installation of a rigid duct ventilation system with external vent and professional finishing.",
    images: [
      existingImage(
        "PXL_20260713_151848763",
        "Bathroom ventilation upgrade with rigid ducting",
        1920,
        1080,
      ),
      existingImage(
        "PXL_20260713_151855125",
        "Alternative view of the rigid ventilation ducting near the bathroom skylight",
        1920,
        1080,
      ),
    ],
  },
  {
    id: "furniture-assembly",
    relatedService: "pricing.html#pricing-furniture",
    title: "Furniture Assembly",
    category: "Furniture Assembly",
    description:
      "Professional flat-pack furniture assembly completed efficiently with great attention to detail.",
    images: [
      existingImage(
        "about",
        "Completed flat-pack furniture assembly",
        1920,
        1397,
      ),
    ],
  },
  {
    id: "wayfair-console-table",
    title: "Wayfair Console Table Assembly",
    category: "Furniture Assembly",
    location: "County Mayo, Ireland",
    description:
      "Assembly of a 160 cm wooden console table supplied by the customer, completed and positioned in their hallway.",
    extendedDescription:
      "The flat-pack furniture was assembled, checked and positioned in the customer's chosen location.",
    result: "A neatly assembled wooden console table, ready for everyday use.",
    relatedService: "pricing.html#pricing-furniture",
    images: [
      consoleImage(
        1,
        "Wide view of the completed wooden console table in the hallway",
      ),
      consoleImage(
        3,
        "Side view of the console table showing its structure and lower shelf",
        true,
      ),
      consoleImage(
        2,
        "Close-up of the console table wooden leg and tabletop detail",
        true,
      ),
      consoleImage(
        4,
        "Front view of the completed 160 cm wooden console table",
      ),
    ],
  },
];
export const projectById = (id) =>
  PROJECTS.find((project) => project.id === id);
