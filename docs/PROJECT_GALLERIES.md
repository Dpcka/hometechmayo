# Project photo galleries

`js/project-data.mjs` is the source of truth: stable IDs, titles, category, description, optional location/details/result/service link, and image arrays. Existing cards are progressively enhanced, so their photographs and text remain available without JavaScript.

After editing data, run `node scripts/render-projects.mjs`; commit both the data and generated `index.html`. Validate with `node scripts/render-projects.mjs --check` and `npm test`. The renderer touches only the marked project-card block. No new production build dependency is needed.

`js/project-gallery.mjs` handles every card using its stable ID. Cards keep separate indexes; the shared native dialog displays only the active project's images. Multi-image cards use small accessible pagination dots and a 500ms crossfade every five seconds. Initial advances are staggered by card order (850ms per card). `js/project-autoplay.mjs` owns independently tested timers. Autoplay pauses on hover, carousel focus, pointer interaction, hidden tabs, offscreen cards and while the full-size viewer is open. A fresh interval, with the per-card stagger, starts when the pause ends so cards do not restart in sync. Reduced motion disables autoplay and transitions, including when the preference changes while the page is open. A single-image project has no dots or timer. No external gallery library is used. Only the currently requested image loads; one temporary copy of the already-loaded previous image provides crossfading. The full-size viewer retains manual arrows and contain fitting; it never autoplays.

For the four supplied console photographs, run:

```powershell
node scripts/prepare-console-images.cjs 'C:\Users\Taras\Pictures'
```

The script only reads the originals. It saves lossless PNG copies in `assets/projects/wayfair-console-table`, stripping ancillary metadata, and creates WebP variants at requested widths 480, 800 and 1600 using quality 82, without enlarging or modifying objects/colours. Portrait originals are 941px wide, so the largest variant is actually 941px; its srcset descriptor records that actual width. All referenced assets and source copies are tracked and deployed as static files; customers use only optimized WebP assets. No unnecessary source metadata is published.

The console image order is 1, 3, 2, 4. The two ventilation photographs were visually checked as matching views of the existing bathroom duct installation. The chest of drawers remains a separate single-photo project. No other existing photographs were reassigned.

Browser QA: start the repository's local static preview on port 8788, set `PLAYWRIGHT_MODULE` to the available Playwright installation, and run `node tests/browser-projects.cjs`. It uses real browser touch events for horizontal/vertical gestures and tests controls, independent state, missing-image recovery, focus, dialog closing, responsive layout and no-JavaScript cards. It never submits quotes or sends email.

`node tests/browser-project-autoplay.cjs` additionally verifies cadence, staggering, crossfade timing, pause/resume events, offscreen loading, live reduced-motion changes and the manual viewer using controlled browser time. Pure scheduler tests run with `npm test`.
