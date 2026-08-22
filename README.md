# hometechmayo
Home Tech Mayo website

## Image Workflow

This workflow requires Node.js LTS, which includes npm.

When you add a new JPG, JPEG or PNG project or service photo, run:

```powershell
npm run images
```

The optimizer creates responsive 82-quality WebP files in the same folder:
`{name}-800.webp` and `{name}-1600.webp`. It keeps the original image and only
regenerates a variant when its source image is newer. Smaller images are never
upscaled.

Example:

1. Add `assets/services/wifi-networking.jpg`
2. Run `npm run images`
3. Use `assets/services/wifi-networking-800.webp` and
   `assets/services/wifi-networking-1600.webp` in an image `srcset`

The command does not change image paths in HTML automatically. Update image
references manually when a specific crop has been reviewed. CSS background
images can continue to use their existing WebP files where `srcset` is not
appropriate.

## SEO Maintenance

Public pages are listed in `sitemap.xml`, and `robots.txt` points search engines
to that sitemap. When adding a new public page, give it a unique title,
description, self-referencing canonical URL and social metadata, then add its
canonical URL to `sitemap.xml`.

Do not add temporary, private or `noindex` pages such as `404.html` to the
sitemap. Review the privacy policy before adding analytics, advertising or new
third-party embeds.
