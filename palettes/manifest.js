// Registry of available paint brands. Adding a new brand: drop a new
// palettes/<id>.js file that registers into window.PBN_PALETTES (see
// kolor-kingdom.js for the format), then add one entry here -- no other
// code changes needed, and it will automatically appear in the dropdown.
//
// Loaded via a plain <script src> rather than fetch()/XHR so this works
// whether the page is opened directly (file://) or served over http(s).
window.PBN_PALETTE_MANIFEST = [
  { id: "kolor-kingdom", label: "Kolor Kingdom (24-color acrylic set)", file: "kolor-kingdom.js" }
];
