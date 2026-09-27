/*
 * PaintMixer — JS port of pbn/color-match.py's paint-mixing recipe finder.
 *
 * Given a palette of real paints (hex + name, optionally a manufacturer
 * code), builds a lookup table of every 1..maxPaints-paint mixture at every
 * whole-number part-ratio summing to totalParts, mixes each using mixbox's
 * pigment-mixing "latent space" model (falling back to a crude geometric-
 * mean-of-reflectance approximation if window.mixbox isn't loaded), and
 * finds the closest mixture (CIELAB nearest-neighbor) to any target hex.
 *
 * Self-contained: does not depend on anything else in pbn/index.html.
 */
(function (global) {
  "use strict";

  // ---------- color conversions (mirrors color-match.py) ----------
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("").toUpperCase()
    );
  }

  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    return c <= 0.0031308 ? c * 12.92 * 255 : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
  }

  function rgb2lab(r, g, b) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
    let Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    let Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
    const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
    X /= Xn; Y /= Yn; Z /= Zn;
    const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // ---------- combinatorics (mirrors compositions()/itertools.combinations()) ----------
  function* combinationsOfArray(arr, k) {
    const n = arr.length;
    const combo = [];
    function* rec(start) {
      if (combo.length === k) { yield combo.slice(); return; }
      for (let i = start; i <= n - (k - combo.length); i++) {
        combo.push(arr[i]);
        yield* rec(i + 1);
        combo.pop();
      }
    }
    yield* rec(0);
  }

  // All positive k-tuples of integers summing to n (direct port of the
  // Python cut-points trick in color-match.py's compositions()).
  function* compositions(n, k) {
    const range = [];
    for (let i = 1; i < n; i++) range.push(i);
    for (const cuts of combinationsOfArray(range, k - 1)) {
      const bounds = [0, ...cuts, n];
      const parts = [];
      for (let i = 0; i < bounds.length - 1; i++) parts.push(bounds[i + 1] - bounds[i]);
      yield parts;
    }
  }

  // ---------- mixing model ----------
  function isMixboxAvailable() {
    return (
      typeof global.mixbox === "object" &&
      typeof global.mixbox.rgbToLatent === "function" &&
      typeof global.mixbox.latentToRgb === "function"
    );
  }

  function makeMixFn(paintRgb) {
    if (isMixboxAvailable()) {
      const mixbox = global.mixbox;
      const paintLatent = paintRgb.map(([r, g, b]) => mixbox.rgbToLatent(r, g, b));
      const LATENT_SIZE = paintLatent.length ? paintLatent[0].length : 7;
      return {
        model: "mixbox",
        mix(indices, weights) {
          // Plain Array, not a typed array: mixbox.latentToRgb requires
          // Array.isArray(latent) === true.
          const z = new Array(LATENT_SIZE).fill(0);
          for (let ii = 0; ii < indices.length; ii++) {
            const lat = paintLatent[indices[ii]];
            const w = weights[ii];
            for (let j = 0; j < LATENT_SIZE; j++) z[j] += w * lat[j];
          }
          const rgb = mixbox.latentToRgb(z);
          return [rgb[0], rgb[1], rgb[2]];
        },
      };
    }
    // Fallback: weighted geometric mean of reflectance (crude subtractive
    // approximation), verbatim port of color-match.py's except-ImportError branch.
    const paintLog = paintRgb.map(([r, g, b]) =>
      [r, g, b].map((v) => Math.log(Math.max(1e-4, srgbToLinear(v))))
    );
    return {
      model: "fallback",
      mix(indices, weights) {
        const logMix = [0, 0, 0];
        for (let ii = 0; ii < indices.length; ii++) {
          const lg = paintLog[indices[ii]];
          const w = weights[ii];
          for (let c = 0; c < 3; c++) logMix[c] += w * lg[c];
        }
        return logMix.map((v) => linearToSrgb(Math.exp(v)));
      },
    };
  }

  // ---------- build lookup table ----------
  // paints: [{hex, name, code?}, ...]
  function buildTable(paints, opts) {
    opts = opts || {};
    const maxPaints = opts.maxPaints || 3;
    const totalParts = opts.totalParts || 10;
    const n = paints.length;
    const paintRgb = paints.map((p) => hexToRgb(p.hex));
    const { mix, model } = makeMixFn(paintRgb);

    const indicesArr = [];
    for (let i = 0; i < n; i++) indicesArr.push(i);

    const recipes = [];
    const rgbList = [];
    for (let k = 1; k <= Math.min(maxPaints, n); k++) {
      for (const combo of combinationsOfArray(indicesArr, k)) {
        for (const parts of compositions(totalParts, k)) {
          const weights = parts.map((p) => p / totalParts);
          const rgb = mix(combo, weights);
          rgbList.push([clampByte(rgb[0]), clampByte(rgb[1]), clampByte(rgb[2])]);
          recipes.push(combo.map((idx, ii) => [idx, parts[ii]]));
        }
      }
    }

    const count = recipes.length;
    const lab = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const [r, g, b] = rgbList[i];
      const L = rgb2lab(r, g, b);
      lab[i * 3] = L[0]; lab[i * 3 + 1] = L[1]; lab[i * 3 + 2] = L[2];
    }

    return { recipes, rgb: rgbList, lab, model, paints };
  }

  function formatRecipeLabel(recipeEntry, paints) {
    return recipeEntry
      .slice()
      .sort((a, b) => b[1] - a[1])
      .map(([idx, parts]) => {
        const p = paints[idx];
        const unit = parts === 1 ? "part" : "parts";
        return `${parts} ${unit} ${p.name}`;
      })
      .join(" + ");
  }

  // ---------- upgraded distance math (CIEDE2000) ----------
  function deltaE2000(l1, a1, b1, l2, a2, b2) {
    const rad2deg = 180 / Math.PI;
    const deg2rad = Math.PI / 180;

    // Chroma
    const c1 = Math.sqrt(a1 * a1 + b1 * b1);
    const c2 = Math.sqrt(a2 * a2 + b2 * b2);
    const cBar = (c1 + c2) / 2;

    const g = 0.5 * (1 - Math.sqrt(Math.pow(cBar, 7) / (Math.pow(cBar, 7) + Math.pow(25, 7))));
    const a1Prime = a1 * (1 + g);
    const a2Prime = a2 * (1 + g);

    const c1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
    const c2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
    const cBarPrime = (c1Prime + c2Prime) / 2;

    // Hue angles
    let h1Prime = 0;
    if (a1Prime !== 0 || b1 !== 0) {
      h1Prime = Math.atan2(b1, a1Prime) * rad2deg;
      if (h1Prime < 0) h1Prime += 360;
    }
    
    let h2Prime = 0;
    if (a2Prime !== 0 || b2 !== 0) {
      h2Prime = Math.atan2(b2, a2Prime) * rad2deg;
      if (h2Prime < 0) h2Prime += 360;
    }

    // Hue differences
    let deltaHPrime = 0;
    if (c1Prime !== 0 && c2Prime !== 0) {
      deltaHPrime = h2Prime - h1Prime;
      if (deltaHPrime > 180) deltaHPrime -= 360;
      else if (deltaHPrime < -180) deltaHPrime += 360;
    }

    const deltaCapHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin((deltaHPrime / 2) * deg2rad);
    const deltaLPrime = l2 - l1;
    const deltaCPrime = c2Prime - c1Prime;

    // Average hue
    let hBarPrime = h1Prime + h2Prime;
    if (c1Prime !== 0 && c2Prime !== 0) {
      if (Math.abs(h1Prime - h2Prime) > 180) {
        hBarPrime = (h1Prime + h2Prime + 360) / 2;
      } else {
        hBarPrime = (h1Prime + h2Prime) / 2;
      }
    }

    const t = 1 -
      0.17 * Math.cos((hBarPrime - 30) * deg2rad) +
      0.24 * Math.cos((2 * hBarPrime) * deg2rad) +
      0.32 * Math.cos((3 * hBarPrime + 6) * deg2rad) -
      0.20 * Math.cos((4 * hBarPrime - 63) * deg2rad);

    const lBar = (l1 + l2) / 2;
    const sl = 1 + (0.015 * Math.pow(lBar - 50, 2)) / Math.sqrt(20 + Math.pow(lBar - 50, 2));
    const sc = 1 + 0.045 * cBarPrime;
    const sh = 1 + 0.015 * cBarPrime * t;

    const deltaTheta = 30 * Math.exp(-Math.pow((hBarPrime - 275) / 25, 2));
    const rc = 2 * Math.sqrt(Math.pow(cBarPrime, 7) / (Math.pow(cBarPrime, 7) + Math.pow(25, 7)));
    const rt = -Math.sin(2 * deltaTheta * deg2rad) * rc;

    // Finally, the Delta E 2000 formula (assuming kl=1, kc=1, kh=1 standard)
    return Math.sqrt(
      Math.pow(deltaLPrime / sl, 2) +
      Math.pow(deltaCPrime / sc, 2) +
      Math.pow(deltaCapHPrime / sh, 2) +
      rt * (deltaCPrime / sc) * (deltaCapHPrime / sh)
    );
  }

  // ---------- query ----------
  // hexArray: [ "#RRGGBB", ... ] -> parallel array of
  // { recipeLabel, deltaE, resultHex } | null (null if table is empty)
  function matchPalette(hexArray, table) {
    const count = table.recipes.length;
    return hexArray.map((hex) => {
      if (count === 0) return null;
      
      const [r, g, b] = hexToRgb(hex);
      const targetLab = rgb2lab(r, g, b);
      const lab = table.lab;
      
      let bestIdx = -1;
      let bestDE = Infinity;
      
      for (let i = 0; i < count; i++) {
        // Extract L, a, b from the Float32Array
        const l1 = lab[i * 3];
        const a1 = lab[i * 3 + 1];
        const b1 = lab[i * 3 + 2];
        
        // Calculate CIEDE2000 instead of Euclidean distance
        const de = deltaE2000(l1, a1, b1, targetLab[0], targetLab[1], targetLab[2]);
        
        if (de < bestDE) { 
          bestDE = de; 
          bestIdx = i; 
        }

        // Optimization: Early exit if perceptually indistinguishable (< 0.5)
        if (bestDE < 0.5) break;
      }
      
      const rgb = table.rgb[bestIdx];
      return {
        recipeLabel: formatRecipeLabel(table.recipes[bestIdx], table.paints),
        deltaE: bestDE, // Note: Returned value is now Delta E 2000
        resultHex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      };
    });
  }

  global.PaintMixer = {
    buildTable,
    matchPalette,
    formatRecipeLabel,
    isMixboxAvailable,
    hexToRgb,
    rgb2lab,
  };
})(window);

