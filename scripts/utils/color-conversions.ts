// --- Color Conversion Utilities ---

/**
 * Converts Hex color string to an OKLCH string "L C H".
 * Handles 6-digit (#RRGGBB) and 8-digit (#RRGGBBAA) hex codes.
 * Ignores the alpha component if present.
 * @param hexCode - Hex color string.
 * @returns OKLCH string "L C H" or throws an error for invalid format.
 */
export function hexToOklchString(hexCode: string): string {
  if (!hexCode.startsWith("#") || (hexCode.length !== 7 && hexCode.length !== 9)) {
    throw new Error(`Invalid hex code format: ${hexCode}`);
  }
  const hexValue = hexCode.slice(1);
  const hexPairs = hexValue.match(/.{2}/g);

  // We only need the first 3 pairs (RGB) for OKLCH conversion
  if (!hexPairs || hexPairs.length < 3) {
    throw new Error(`Invalid hex code format: ${hexCode}`);
  }

  const [rHex, gHex, bHex] = hexPairs;
  const r = parseInt(rHex!, 16);
  const g = parseInt(gHex!, 16);
  const b = parseInt(bHex!, 16);

  // Check for non-hex characters resulting in NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex code format (contains non-hex characters): ${hexCode}`);
  }

  // --- Start RGB to OKLCH conversion ---

  // Step 1: Convert sRGB values from [0,255] to normalized [0,1]
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Linearize each channel using the sRGB companding formula.
  const srgbToLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = srgbToLinear(rNorm);
  const gLin = srgbToLinear(gNorm);
  const bLin = srgbToLinear(bNorm);

  // Step 2: Convert linear RGB to LMS with the appropriate matrix transformation.
  const L = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const M = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const S = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  // Step 3: Take the cube root of the LMS values.
  // Avoid NaN for zero values by adding a small epsilon or checking explicitly.
  const epsilon = 1e-10;
  const lRoot = Math.cbrt(Math.max(0, L));
  const mRoot = Math.cbrt(Math.max(0, M));
  const sRoot = Math.cbrt(Math.max(0, S));

  // Step 4: Convert to OKLab using the defined linear transformation.
  const L_ok = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a_ok = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b_ok = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  // Step 5: Convert OKLab to OKLCH.
  const C = Math.sqrt(a_ok * a_ok + b_ok * b_ok);
  let hue = 0;
  if (C > 1e-5) {
    hue = Math.atan2(b_ok, a_ok) * (180 / Math.PI);
    if (hue < 0) {
      hue += 360;
    }
  }

  // Round the results to three decimal places. Use L_ok directly for Lightness.
  const L_rounded = Math.round(L_ok * 1000) / 1000;
  const C_rounded = Math.round(C * 1000) / 1000;
  const hue_rounded = Math.round(hue * 1000) / 1000;

  // Return the OKLCH values as a space-separated string.
  return `${L_rounded} ${C_rounded} ${hue_rounded}`;
  // --- End RGB to OKLCH conversion ---
}

/**
 * Converts RGBA color string to an OKLCH string "L C H / A".
 * Parses RGBA string, converts RGB to OKLCH, and appends alpha.
 * @param rgbaString - RGBA color string (e.g., "rgba(0, 0, 0, 0.5)").
 * @returns OKLCH string "L C H / A" or null for invalid format.
 */
export function rgbaStringToOklchString(rgbaString: string): string | null {
  const rgbaRegex = /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/;
  const matches = rgbaString.match(rgbaRegex);
  if (!matches || matches.length < 5) {
    console.warn(`Invalid RGBA string format encountered: ${rgbaString}`);
    return null;
  }
  // Use parseFloat as Radix source might use floats, though typically they are ints
  const r = parseFloat(matches[1]!);
  const g = parseFloat(matches[2]!);
  const b = parseFloat(matches[3]!);
  const a = parseFloat(matches[4]!);

  // --- Start RGB to OKLCH conversion (adapted from hexToOklchString) ---
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const srgbToLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = srgbToLinear(rNorm);
  const gLin = srgbToLinear(gNorm);
  const bLin = srgbToLinear(bNorm);

  const L = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const M = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const S = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  const lRoot = Math.cbrt(Math.max(0, L));
  const mRoot = Math.cbrt(Math.max(0, M));
  const sRoot = Math.cbrt(Math.max(0, S));

  const L_ok = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a_ok = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b_ok = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const C = Math.sqrt(a_ok * a_ok + b_ok * b_ok);
  let hue = 0;
  if (C > 1e-5) {
    hue = Math.atan2(b_ok, a_ok) * (180 / Math.PI);
    if (hue < 0) {
      hue += 360;
    }
  }

  const L_rounded = Math.round(L_ok * 1000) / 1000;
  const C_rounded = Math.round(C * 1000) / 1000;
  const hue_rounded = Math.round(hue * 1000) / 1000;

  // Round alpha to 3 decimal places
  const a_rounded = Math.round(a * 1000) / 1000;

  // Return the OKLCH values + Alpha as a space-separated string.
  // Append alpha only if it's not 1 (like CSS convention)
  return `${L_rounded} ${C_rounded} ${hue_rounded}${a_rounded !== 1 ? ` / ${a_rounded}` : ""}`;
  // --- End RGB to OKLCH conversion ---
}

/**
 * Converts HSLA color string to an OKLCH string "L C H / A".
 * Parses HSLA string, converts HSLA to OKLCH, and appends alpha.
 * @param hslaString - HSLA color string (e.g., "hsla(212, 100%, 50%, 0.5)").
 * @returns OKLCH string "L C H / A" or throws error for invalid format.
 */
export function hslaStringToOklchString(hslaString: string): string {
  const hslaRegex = /hsla\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/;
  const matches = hslaString.match(hslaRegex);
  if (!matches || matches.length < 5) {
    throw new Error(`Invalid HSLA string format: ${hslaString}`);
  }
  const [, hStr, sStr, lStr, aStr] = matches;
  const h = parseFloat(hStr);
  const s = parseFloat(sStr); // Keep as percentage for input
  const l = parseFloat(lStr); // Keep as percentage for input
  const a = parseFloat(aStr);

  // --- Start HSLA to OKLCH conversion (based on user example) ---

  // --- Step 1: Convert HSLA to RGBA ---
  const saturation = s / 100;
  const lightness = l / 100;
  let r: number, g: number, b: number;

  if (saturation === 0) {
    r = g = b = lightness;
  } else {
    const hueToRgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q =
      lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    const hNorm = h / 360;
    r = hueToRgb(p, q, hNorm + 1 / 3);
    g = hueToRgb(p, q, hNorm);
    b = hueToRgb(p, q, hNorm - 1 / 3);
  }

  const r255 = Math.round(r * 255);
  const g255 = Math.round(g * 255);
  const b255 = Math.round(b * 255);

  // --- Step 2: Convert RGBA to OKLCH (reuse logic from other converters) ---
  const rNorm = r255 / 255;
  const gNorm = g255 / 255;
  const bNorm = b255 / 255;

  const srgbToLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = srgbToLinear(rNorm);
  const gLin = srgbToLinear(gNorm);
  const bLin = srgbToLinear(bNorm);

  const L = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const M = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const S = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  const lRoot = Math.cbrt(Math.max(0, L));
  const mRoot = Math.cbrt(Math.max(0, M));
  const sRoot = Math.cbrt(Math.max(0, S));

  const L_ok = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a_ok = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b_ok = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const C = Math.sqrt(a_ok * a_ok + b_ok * b_ok);
  let hueOklch = 0;
  if (C > 1e-5) {
    hueOklch = Math.atan2(b_ok, a_ok) * (180 / Math.PI);
    if (hueOklch < 0) {
      hueOklch += 360;
    }
  }

  const L_rounded = Math.round(L_ok * 1000) / 1000;
  const C_rounded = Math.round(C * 1000) / 1000;
  const hue_rounded = Math.round(hueOklch * 1000) / 1000;

  const a_rounded = Math.round(a * 1000) / 1000;

  return `${L_rounded} ${C_rounded} ${hue_rounded}${a_rounded !== 1 ? ` / ${a_rounded}` : ""}`;
  // --- End HSLA to OKLCH conversion ---
}

/**
 * Converts P3 color string to a basic "R G B / A" string representation.
 * Note: This does NOT convert P3 to sRGB or OKLCH, it just extracts values.
 * @param p3ColorString - P3 color string (e.g., "color(display-p3 0.5 0.5 0.5 / 0.5)").
 * @param requireAlpha - Whether an alpha value is required for the match.
 * @returns Extracted "R G B / A" or "R G B" string, or null if format mismatch.
 */
export function p3ToP3String(p3ColorString: string, requireAlpha: boolean): string | null {
  const p3Matches = p3ColorString.match(
    /color\(display-p3 ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/,
  );
  if (!p3Matches) return null;
  const [, r, g, b, a] = p3Matches;
  if (requireAlpha && !a) return null; // Alpha is required but not present
  if (!requireAlpha && a) return null; // Alpha is present but not required (match solid/alpha correctly)
  return `${r} ${g} ${b}${a ? ` / ${a}` : ""}`;
}
