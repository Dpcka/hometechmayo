# hometechmayo
Home Tech Mayo website

## Image Workflow

This workflow requires Node.js LTS, which includes npm.

When you add a new JPG, JPEG or PNG project or service photo, run:

```powershell
npm run images
```

The optimizer creates an 82-quality WebP file in the same folder, keeps the
original image and only regenerates WebP files when their source image is newer.
It automatically limits very large photographs to 1920px wide without upscaling
smaller images.

Example:

1. Add `assets/services/wifi-networking.jpg`
2. Run `npm run images`
3. Use `assets/services/wifi-networking.webp` in the HTML

The command does not change image paths in HTML automatically. Update image
references manually when a specific crop has been reviewed.
