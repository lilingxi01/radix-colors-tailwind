import fs from "fs/promises";
import path from "path";
import { headerComment } from "./header-comment";
import {
  hexToOklchString,
  hslaStringToOklchString,
  rgbaStringToOklchString,
  p3ToP3String,
} from "./utils/color-conversions";
import { sortVarNames } from "./utils/sorting";

const outputDir = "dist";

// --- Regex Definitions ---
const hexRegex = /^--(\w+)-(\d+|a\d+):\s*(#[0-9a-fA-F]{6,8});$/;
const p3Regex =
  /^--(\w+)-(\d+|a\d+):\s*color\(display-p3 ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\);$/;
const hslaRegex = /^--(\w+)-(a\d+):\s*hsla\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\);$/;

// --- Combined Parser & Generator ---

// Interface to hold sRGB (fallback) and P3 color definitions
interface ColorDefinition {
  srgb: string | null;
  p3: string | null;
}

/** Interface to store parsed light/dark values for a single Radix variable */
interface ParsedColorValue {
  light: ColorDefinition;
  dark: ColorDefinition;
}

/**
 * Parses all relevant source CSS files for a given base color name
 * and generates a single combined CSS file in the output directory.
 * @param baseName - The base color name (e.g., "blue", "red", "black-alpha").
 * @param sourceFiles - Array of full paths to source CSS files (e.g., blue.css, blue-dark.css, ...).
 * @param outputDirPath - The path to the output directory (e.g., "dist").
 */
async function parseAndGenerateCombinedCss(
  baseName: string,
  sourceFiles: string[],
  outputDirPath: string,
) {
  /** Stores parsed values keyed by the original Radix variable name (e.g., --blue-1) */
  const combinedParsed: Record<string, ParsedColorValue> = {};
  /** Regex to capture variable name and value */
  const varRegex = /^(--\w+(?:-\w+)*):\s*(.*);$/;
  /** The color name used for filtering variables (e.g., blue, black, white) */
  const expectedStemName =
    baseName === "black-alpha" || baseName === "white-alpha" ? baseName.split("-")[0] : baseName;

  // --- Parse all source files ---
  for (const filePath of sourceFiles) {
    try {
      const file = Bun.file(filePath);
      const text = await file.text();
      if (!text) continue;

      const lines = text.split("\n");
      /** Tracks the current CSS selector scope (light, dark, or unknown) */
      let currentSelectorScope: "light" | "dark" | "unknown" = "unknown";
      /** Tracks CSS block nesting level to correctly identify scope end */
      let braceLevel = 0;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Detect Scope Start based on common Radix patterns
        if (
          trimmedLine.startsWith(":root,") ||
          trimmedLine.startsWith(".light,") ||
          trimmedLine.startsWith(":root {") /* Handle standalone :root */
        ) {
          currentSelectorScope = "light";
          if (trimmedLine.includes("{")) braceLevel = 1;
        } else if (trimmedLine.startsWith(".dark,")) {
          currentSelectorScope = "dark";
          if (trimmedLine.includes("{")) braceLevel = 1;
        }

        // Track nesting level within the detected scope
        if (currentSelectorScope === "light" || currentSelectorScope === "dark") {
          braceLevel += (trimmedLine.match(/\{/g) || []).length;
          braceLevel -= (trimmedLine.match(/\}/g) || []).length;
          // Handle edge case where scope definition and { are on the same line
          if (
            (trimmedLine.startsWith(":root {") ||
              trimmedLine.startsWith(".light {") ||
              trimmedLine.startsWith(".dark {")) &&
            trimmedLine.includes("{")
          ) {
            braceLevel = Math.max(1, braceLevel);
          }
        }

        // Process variable only if scope is known and we are inside a block
        if (
          (currentSelectorScope === "light" || currentSelectorScope === "dark") &&
          braceLevel > 0 &&
          trimmedLine.startsWith("--")
        ) {
          const matches = trimmedLine.match(varRegex);
          if (matches && matches[1] && matches[2]) {
            const variableName = matches[1];
            const value = matches[2];

            // Filter variables to only include those matching the expected stem name
            if (!variableName.startsWith(`--${expectedStemName}-`)) {
              // Allow --black-a* / --white-a* when processing black-alpha / white-alpha
              if (
                !(
                  (expectedStemName === "black" || expectedStemName === "white") &&
                  variableName.startsWith(`--${expectedStemName}-a`)
                )
              ) {
                continue;
              }
            }

            // Initialize if first time seeing this variable
            if (!combinedParsed[variableName]) {
              combinedParsed[variableName] = {
                light: { srgb: null, p3: null },
                dark: { srgb: null, p3: null },
              };
            }

            // Assign value to the correct slot (light/dark), only if not already assigned
            if (currentSelectorScope === "light") {
              // Check if it's a P3 value first
              if (value.startsWith("color(display-p3")) {
                if (combinedParsed[variableName].light.p3 === null) {
                  combinedParsed[variableName].light.p3 = value;
                }
              } else {
                // Otherwise, assume sRGB fallback
                if (combinedParsed[variableName].light.srgb === null) {
                  combinedParsed[variableName].light.srgb = value;
                }
              }
            } else {
              // Must be dark scope
              if (value.startsWith("color(display-p3")) {
                if (combinedParsed[variableName].dark.p3 === null) {
                  combinedParsed[variableName].dark.p3 = value;
                }
              } else {
                if (combinedParsed[variableName].dark.srgb === null) {
                  combinedParsed[variableName].dark.srgb = value;
                }
              }
            }
          }
        }

        // Reset scope when exiting the detected block
        if (
          (currentSelectorScope === "light" || currentSelectorScope === "dark") &&
          braceLevel <= 0
        ) {
          currentSelectorScope = "unknown";
          braceLevel = 0;
        }
      }
    } catch (error) {
      // Handle file read errors (e.g., a dark file might not exist)
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        // Safely ignore file not found
      } else {
        throw error; // Rethrow other errors
      }
    }
  }
  // --- End Parsing ---

  // --- Construct CSS ---
  const lightRgbLines: string[] = [];
  const darkRgbLines: string[] = [];
  const themeLines: string[] = [];
  const intermediateLines: string[] = []; // Collect intermediate defs here
  const p3LightOverrides: string[] = [];
  const p3DarkOverrides: string[] = [];
  const p3IntermediateOverrides: string[] = []; // Single list for all intermediate overrides in P3

  // Sort variable names for consistent output order
  const varNames = Object.keys(combinedParsed).sort(sortVarNames);

  // Determine the stem name for generated variables (e.g., blue, black, white)
  const outputStemName =
    baseName === "black-alpha" || baseName === "white-alpha"
      ? baseName.replace("-alpha", "")
      : baseName;

  for (const variableName of varNames) {
    const parsedValue = combinedParsed[variableName];
    // Extract the index part (e.g., 1, a1) from the variable name
    const matches = variableName.match(/^--\w+-(\d+|a\d+)$/);
    if (!matches || !matches[1]) continue; // Skip if format is unexpected
    const index = matches[1];
    const outputIndex = index; // Use the parsed index directly

    // Define the output variable names
    const rgbVar = `--radix-rgb-${outputStemName}-${outputIndex}`; // Holds L C H / A or P3 string
    const intermediateVar = `--radix-intermediate-${outputStemName}-${outputIndex}`; // Intermediate step
    const themeVar = `--color-${outputStemName}-${outputIndex}`; // Final theme variable

    // Always generate the Tailwind theme mapping line (now points to intermediate)
    themeLines.push(`  ${themeVar}: var(${intermediateVar});`);

    // Convert and add the light mode definition if a light value exists
    if (parsedValue.light.srgb) {
      let oklchString: string | null = null;
      let alphaValue: string | null = null; // To store extracted alpha from hex codes

      try {
        if (parsedValue.light.srgb.startsWith("#")) {
          oklchString = hexToOklchString(parsedValue.light.srgb); // This only gives L C H
          // Check if it was an 8-digit hex to extract alpha separately
          if (parsedValue.light.srgb.length === 9) {
            const alphaHex = parsedValue.light.srgb.slice(7);
            const alpha = parseInt(alphaHex, 16);
            if (!isNaN(alpha)) {
              alphaValue = (Math.round((alpha / 255) * 1000) / 1000).toString();
            }
          }
        } else if (parsedValue.light.srgb.startsWith("hsla")) {
          oklchString = hslaStringToOklchString(parsedValue.light.srgb); // Returns "L C H / A" or "L C H"
        } else if (parsedValue.light.srgb.startsWith("rgba")) {
          oklchString = rgbaStringToOklchString(parsedValue.light.srgb); // Returns "L C H / A" or "L C H"
        }
        // TODO: Handle p3 colors properly (conversion to OKLCH or pass through)
        // else if (parsedValue.light.srgb.startsWith("color(display-p3")) { ... }
      } catch (error) {
        console.error(
          `Error converting light value for ${variableName}: ${parsedValue.light.srgb}`,
          error,
        );
      }

      // Append the variable definition (OKLCH fallback)
      if (oklchString) {
        // If alpha was separately extracted (only for hex), append it.
        // Otherwise, oklchString already contains alpha if needed.
        const finalValue = alphaValue ? `${oklchString} / ${alphaValue}` : oklchString;
        lightRgbLines.push(`  ${rgbVar}: ${finalValue};`);
        // Collect intermediate variable definition (only once per var)
        if (!intermediateLines.some(line => line.startsWith(`  ${intermediateVar}:`))) {
          intermediateLines.push(`  ${intermediateVar}: oklch(var(${rgbVar}));`);
        }
      }

      // Store P3 override if available
      if (parsedValue.light.p3) {
        p3LightOverrides.push(`  ${rgbVar}: ${parsedValue.light.p3};`);
        // Add intermediate override if not already added for this var
        if (!p3IntermediateOverrides.some(line => line.startsWith(`  ${intermediateVar}:`))) {
          p3IntermediateOverrides.push(`  ${intermediateVar}: var(${rgbVar});`);
        }
      }
    }

    // Convert and add the dark mode definition if a dark value exists
    if (parsedValue.dark.srgb) {
      let oklchString: string | null = null;
      let alphaValue: string | null = null; // To store extracted alpha from hex codes

      try {
        if (parsedValue.dark.srgb.startsWith("#")) {
          oklchString = hexToOklchString(parsedValue.dark.srgb); // L C H
          if (parsedValue.dark.srgb.length === 9) {
            const alphaHex = parsedValue.dark.srgb.slice(7);
            const alpha = parseInt(alphaHex, 16);
            if (!isNaN(alpha)) {
              alphaValue = (Math.round((alpha / 255) * 1000) / 1000).toString();
            }
          }
        } else if (parsedValue.dark.srgb.startsWith("hsla")) {
          oklchString = hslaStringToOklchString(parsedValue.dark.srgb); // L C H / A
        } else if (parsedValue.dark.srgb.startsWith("rgba")) {
          oklchString = rgbaStringToOklchString(parsedValue.dark.srgb); // L C H / A
        }
        // TODO: Handle p3 colors
      } catch (error) {
        console.error(
          `Error converting dark value for ${variableName}: ${parsedValue.dark.srgb}`,
          error,
        );
      }

      // Append the variable definition (OKLCH fallback)
      if (oklchString) {
        const finalValue = alphaValue ? `${oklchString} / ${alphaValue}` : oklchString;
        darkRgbLines.push(`  ${rgbVar}: ${finalValue};`);
        // Collect intermediate variable definition (only once per var)
        if (!intermediateLines.some(line => line.startsWith(`  ${intermediateVar}:`))) {
          intermediateLines.push(`  ${intermediateVar}: oklch(var(${rgbVar}));`);
        }
      }

      // Store P3 override if available
      if (parsedValue.dark.p3) {
        p3DarkOverrides.push(`  ${rgbVar}: ${parsedValue.dark.p3};`);
        // Add intermediate override if not already added for this var
        if (!p3IntermediateOverrides.some(line => line.startsWith(`  ${intermediateVar}:`))) {
          p3IntermediateOverrides.push(`  ${intermediateVar}: var(${rgbVar});`);
        }
      }
    }
  }

  // --- Construct Final CSS Content String ---
  let cssContent = `${headerComment}\n\n`;

  // Add light mode block
  if (lightRgbLines.length > 0) {
    const lightSelectors =
      baseName === "black-alpha" || baseName === "white-alpha"
        ? ":root"
        : ":root,\n.light,\n.light-theme";
    cssContent += `${lightSelectors} {\n${lightRgbLines.join("\n")}\n}\n`;
  }

  // Add intermediate variable definitions (globally, once)
  if (intermediateLines.length > 0) {
    // Custom sort based on the variable name extracted from the full line
    intermediateLines.sort((a, b) => {
      const nameA = a.match(/^\s*(--\S+):/)?.[1] ?? ""; // Extract '--radix-intermediate-...' name
      const nameB = b.match(/^\s*(--\S+):/)?.[1] ?? ""; // Extract '--radix-intermediate-...' name
      // Now use the original sort function on the extracted names
      return sortVarNames(nameA, nameB);
    });
    cssContent += `\n:root {\n${intermediateLines.join("\n")}\n}\n`;
  }

  // Add dark mode block (class-based)
  if (darkRgbLines.length > 0) {
    cssContent += `\n.dark,\n.dark-theme {\n${darkRgbLines.join("\n")}\n}\n`;
  }

  // Add Tailwind theme mapping block
  if (themeLines.length > 0) {
    cssContent += `\n@theme inline {\n${themeLines.join("\n")}\n}\n`;
  }

  // --- Add P3 Gamut Support ---
  // Check if there are *any* P3 overrides to generate the block
  if (
    p3IntermediateOverrides.length > 0 ||
    p3LightOverrides.length > 0 ||
    p3DarkOverrides.length > 0
  ) {
    cssContent += `\n@supports (color: color(display-p3 1 1 1)) {\n`;
    cssContent += `  @media (color-gamut: p3) {\n`;

    // P3 overrides for intermediate variables (apply once in :root)
    if (p3IntermediateOverrides.length > 0) {
      // Custom sort based on the variable name extracted from the full line
      p3IntermediateOverrides.sort((a, b) => {
        const nameA = a.match(/^\s*(--\S+):/)?.[1] ?? ""; // Extract '--radix-intermediate-...' name
        const nameB = b.match(/^\s*(--\S+):/)?.[1] ?? ""; // Extract '--radix-intermediate-...' name
        // Now use the original sort function on the extracted names
        return sortVarNames(nameA, nameB);
      });
      cssContent += `    :root {\n${p3IntermediateOverrides
        .map(line => `      ${line.trim()}`) // Indent variable lines
        .join("\n")}\n    }\n`;
    }

    // P3 overrides for light mode (--radix-rgb)
    if (p3LightOverrides.length > 0) {
      const lightSelectors =
        baseName === "black-alpha" || baseName === "white-alpha"
          ? ":root"
          : ":root,\n    .light,\n    .light-theme";
      cssContent += `    ${lightSelectors} {\n${p3LightOverrides.map(line => `      ${line.trim()}`).join("\n")}\n    }\n`;
    }

    // P3 overrides for dark mode (--radix-rgb)
    if (p3DarkOverrides.length > 0) {
      cssContent += `    .dark,\n    .dark-theme {\n${p3DarkOverrides.map(line => `      ${line.trim()}`).join("\n")}\n    }\n`;
    }

    cssContent += `  }\n`; // Close @media (color-gamut: p3)
    cssContent += `}\n`; // Close @supports
  }

  // --- Write File ---
  const outputFilePath = path.join(outputDirPath, `${baseName}.css`);
  // Ensure final newline
  await Bun.write(outputFilePath, cssContent.trim() + "\n");
}

// --- Main Orchestration Logic ---

/**
 * Main function to find Radix source files, group them by color,
 * and orchestrate the parsing and generation of combined CSS files.
 */
async function main() {
  const __dirname = path.resolve();
  // Find the installed @radix-ui/colors package
  const radixPackagePath = require.resolve("@radix-ui/colors");
  // Get the directory path relative to the current script
  let radixSourcePath = path.relative(__dirname, radixPackagePath);
  radixSourcePath = radixSourcePath.replace(/index.js$/, "");

  const outputDirPath = path.join(__dirname, outputDir);
  // Clean the output directory before generation
  try {
    await fs.access(outputDirPath);
    await fs.rm(outputDirPath, { recursive: true });
  } catch {}
  await fs.mkdir(outputDirPath, { recursive: true });

  const allSourceFiles = await fs.readdir(radixSourcePath);
  const cssFiles = allSourceFiles.filter(file => file.endsWith(".css"));

  // Group source CSS files by their base color name (e.g., "blue", "black-alpha")
  const fileGroups: Record<string, string[]> = {};
  /** Regex to capture the base color name from a Radix CSS filename */
  const nameRegex = /^([a-z]+)(?:-(?:dark|alpha))*.css$/;
  /** Regex to specifically capture black/white alpha filenames */
  const alphaNameRegex = /^(black|white)-alpha.css$/;

  for (const file of cssFiles) {
    let baseName: string | null = null;
    const alphaMatch = file.match(alphaNameRegex);
    if (alphaMatch && alphaMatch[1]) {
      // Use "black-alpha" or "white-alpha" as the group key
      baseName = `${alphaMatch[1]}-alpha`;
    } else {
      // Otherwise, use the first part of the name (e.g., "blue", "red")
      const match = file.match(nameRegex);
      if (match && match[1]) {
        baseName = match[1];
      }
    }

    // Add the full path of the file to the corresponding group
    if (baseName) {
      if (!fileGroups[baseName]) {
        fileGroups[baseName] = [];
      }
      fileGroups[baseName].push(path.join(radixSourcePath, file));
    }
  }

  // Iterate through each color group and generate the combined CSS file
  const generationPromises = Object.keys(fileGroups).map(baseName => {
    const sourceFilesForColor = fileGroups[baseName];
    if (!sourceFilesForColor || sourceFilesForColor.length === 0) return Promise.resolve(); // Skip empty groups
    return parseAndGenerateCombinedCss(baseName, sourceFilesForColor, outputDirPath);
  });

  await Promise.all(generationPromises);

  // --- Generate main import file ---
  const generatedFiles = (await fs.readdir(outputDirPath))
    .filter(file => file.endsWith(".css"))
    .sort(); // Sort for consistent order

  let mainCssContent = `${headerComment}\n\n`;
  for (const file of generatedFiles) {
    // Use the desired import path format
    mainCssContent += `@import "radix-colors-tailwind/dist/${file}";\n`;
  }

  const mainOutputFilePath = path.join(outputDirPath, "radix-colors.css");
  await Bun.write(mainOutputFilePath, mainCssContent.trim() + "\n");

  console.log(`Generated Radix color files in ${outputDir}`);
}

main().catch(console.error);
