# Paint-by-Numbers Generator

Visit [https://jenna1701.github.io/pbn/](https://jenna1701.github.io/pbn/) to use the interative paint-by-numbers generator.

## What is it

A single-page web app that turns any photo into a printable paint-by-numbers image, along with a matching color palette legend. Everything runs locally in the browser — no images are ever uploaded to a server, and the app works as a static file on any web host, including GitHub Pages.

## What it does

You upload a photo (JPG, PNG, or WEBP) by dragging it into the drop zone or choosing it from your device. The app analyzes the image's colors and produces:

- A posterized color preview showing the image reduced to a flat, simplified palette.
- A paint-by-numbers output with clean outlines between color regions and a small number in each region indicating which palette color belongs there.
- A palette legend listing every color used, each with its swatch, number, hex code, and RGB values.

## Color selection

Colors are chosen using a perceptually-aware clustering approach that works in a color space designed to match human color perception rather than raw pixel values. This helps ensure that visually distinct colors — even ones that appear in only a small part of the image — are preserved as their own palette entries rather than being absorbed into a more common, similar-looking color. You control how many total colors are used, from a simple, high-contrast palette to a highly detailed one.

## Smoothing and cleanup

An adjustable smoothing setting controls how clean and simplified the final regions look. Lower settings preserve more fine detail and texture; higher settings blur out noise before color selection, smooth jagged region borders, and merge away tiny stray specks into their neighboring region. This makes it easy to trade off between a highly detailed result and a simpler, easier-to-paint result.

A separate Line Smoothing setting runs as a final cleanup pass over the finished outlines, rounding off small, wiggly offshoots along region borders so the shapes are easier to trace and paint. It doesn't change the palette or how many colors are used. On the rare occasion it smooths a region apart into two separate pieces, both pieces still get correctly numbered.

## Numbering behavior

Numbers are placed at the most interior point of each region — the spot farthest from any outline — so they stay readable and don't overlap the region's edges. Regions that are too small or too thin to fit a number cleanly are simply left unlabeled rather than crowding the image. If two candidate labels would end up landing too close together, the smaller region's label is skipped in favor of the larger one. For regions that are large or spread out — a big sky, or a long, winding, branching shape — the same number is repeated at several well-spaced interior points across the region, so it's always clear which color to use no matter where you're currently painting. Numbers can also be turned off entirely if you only want the outlines.

## Style options

A "printable coloring-page style" option switches the output between a colored preview with outlines and numbers, or a clean white background with only outlines and numbers for printing and painting.

## Resizing and cropping

An optional resize-and-crop feature lets you target a specific physical print size in inches at a chosen resolution (DPI). When enabled, the image is center-cropped to match the target aspect ratio and then scaled to the exact pixel dimensions needed for that size and resolution. By default this feature is off, and the image is processed at its original, full resolution with no cropping.

## Saving your results

A save action downloads three PNG files: the paint-by-numbers image itself, the palette legend for reference while painting, and the posterized color preview.

## Matching legend colors to real paints

A "Paint Brand" dropdown lets you match each legend color to an actual paint-mixing recipe from a real paint set, instead of just a hex code. Pick a brand and every swatch in the legend (and in the exported palette PNG) also shows something like "4 parts Yellow Ochre + 4 parts Colbalt Blue + 2 parts Carmine Red", listed from the most-used paint to the least. Recipes are found using the [mixbox](https://github.com/scrtwpns/mixbox) pigment-mixing model, which simulates how real paints blend rather than just averaging RGB values, and are computed once per brand and cached, so switching back and forth is instant after the first time.

Kolor Kingdom (a 24-color acrylic set) is the only brand included today, but the list is data-driven — see below for how to add another.

### Adding a new paint brand

Adding a brand is a data-only change; no changes to the app's logic are needed and it will appear in the dropdown automatically. To add one:

1. Create a new file `palettes/<your-brand-id>.js` that registers the brand's paints, following the format in `palettes/kolor-kingdom.js`:
   ```js
   window.PBN_PALETTES = window.PBN_PALETTES || {};
   window.PBN_PALETTES["your-brand-id"] = {
     "#1A1A1A": { "code": "0753", "name": "Black" },
     "#F8F8F8": { "code": "0105", "name": "Titanium White" }
     // ...one entry per paint in the set: hex color -> manufacturer code + name
   };
   ```
   The `code` field is optional and reserved for future use, but `name` is required.
2. Add one entry to `palettes/manifest.js`:
   ```js
   { id: "your-brand-id", label: "Your Brand Name (description)", file: "your-brand-id.js" }
   ```
3. Reload the page and the new brand shows up in the "Paint Brand" dropdown.

## Re-running with different settings

Resize and crop, color count, smoothing, style, and number visibility can all be adjusted and re-generated as many times as you like without re-uploading the image, so you can quickly compare different levels of detail and simplification.

## 



*Code written by Claude Sonnet 5.*
