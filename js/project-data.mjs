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
  {
    "id": "westport-furniture-assembly",
    "title": "Complete Furniture Assembly – Two Residential Properties in Westport",
    "category": "Furniture Assembly",
    "location": "Westport, Co. Mayo, Ireland",
    "completionDate": "2026-11",
    "description": "Complete furniture assembly across two residential properties in Westport, Co. Mayo, prepared for long-term rental.",
    "extendedDescription": "The project involved assembling and positioning 14 furniture items from JYSK, including two wardrobes, two dining tables, six dining chairs, two TV units and two coffee tables.\n\nAll furniture was carefully assembled, aligned and checked for stability and functionality. Additional adjustments were also carried out on an existing wardrobe.\n\nThe project was completed over two days, providing a comprehensive furniture assembly service for both properties.",
    "relatedService": "pricing.html#pricing-furniture",
    "websiteReviewAssociation": false,
    "testimonial": {
      "text": "Excellent service and very good workmanship for flat pack furniture assembly.",
      "author": "Finbar",
      "location": "Westport",
      "source": "Bark",
      "rating": 5,
      "url": "https://www.bark.com/en/ie/company/home-tech-solutions-amp-services/2MMmoA/"
    },
    "images": [
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-living-room-overview-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-living-room-overview-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-living-room-overview-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-living-room-overview-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-living-room-overview-1481.webp",
        "alt": "Completed living room in Westport with assembled JYSK TV unit and coffee table",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-coffee-table-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-coffee-table-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-coffee-table-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-coffee-table-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-coffee-table-1481.webp",
        "alt": "Assembled JYSK TV unit and coffee table positioned beside the living-room sofa",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-coffee-table-sofa-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-coffee-table-sofa-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-coffee-table-sofa-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-coffee-table-sofa-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-coffee-table-sofa-1481.webp",
        "alt": "Wooden JYSK coffee table assembled and positioned in front of the sofa",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-storage-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-storage-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-storage-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-storage-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-tv-unit-storage-1481.webp",
        "alt": "Completed wooden JYSK TV unit with drawers and open storage",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-dining-area-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-dining-area-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-dining-area-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-dining-area-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-dining-area-1481.webp",
        "alt": "Completed dining area with assembled wooden table and chairs in Westport",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-chairs-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-chairs-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-dining-table-chairs-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-dining-table-chairs-1481.webp 1481w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-chairs-1481.webp",
        "alt": "Assembled JYSK dining table with upholstered dining chairs",
        "width": 1481,
        "height": 833,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-leg-detail-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-leg-detail-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-dining-table-leg-detail-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-dining-table-leg-detail-843.webp 843w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-dining-table-leg-detail-843.webp",
        "alt": "Dining table leg and frame detail after furniture assembly",
        "width": 843,
        "height": 1499,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-second-dining-table-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-second-dining-table-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-second-dining-table-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-second-dining-table-843.webp 843w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-second-dining-table-843.webp",
        "alt": "Second assembled dining table positioned beside the stone fireplace",
        "width": 843,
        "height": 1499,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-bedroom-wardrobe-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-bedroom-wardrobe-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-bedroom-wardrobe-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-bedroom-wardrobe-843.webp 843w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-bedroom-wardrobe-843.webp",
        "alt": "Completed bedroom with assembled white JYSK wardrobe beside the bed",
        "width": 843,
        "height": 1499,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-white-wardrobe-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-white-wardrobe-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-white-wardrobe-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-white-wardrobe-843.webp 843w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-white-wardrobe-843.webp",
        "alt": "Assembled white wardrobe with wooden top and lower drawers",
        "width": 843,
        "height": 1499,
        "position": "center"
      },
      {
        "src": "assets/projects/westport-furniture-assembly/westport-jysk-wardrobe-positioned-800.webp",
        "srcset": "assets/projects/westport-furniture-assembly/westport-jysk-wardrobe-positioned-480.webp 480w, assets/projects/westport-furniture-assembly/westport-jysk-wardrobe-positioned-800.webp 800w, assets/projects/westport-furniture-assembly/westport-jysk-wardrobe-positioned-843.webp 843w",
        "full": "assets/projects/westport-furniture-assembly/westport-jysk-wardrobe-positioned-843.webp",
        "alt": "White wardrobe positioned in a bedroom after assembly and alignment",
        "width": 843,
        "height": 1499,
        "position": "center"
      }
    ]
  },
];
export const projectById = (id) =>
  PROJECTS.find((project) => project.id === id);
