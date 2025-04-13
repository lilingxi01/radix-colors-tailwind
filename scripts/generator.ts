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

/** Interface to store parsed light/dark values for a single Radix variable (e.g., --blue-1) */
interface ParsedColorValue {
  lightValue: string | null; // Raw value string (e.g., #..., hsla(...), rgba(...))
  darkValue: string | null; // Raw value string
  // p3LightValue: string | null; // Reserved for future P3 support
  // p3DarkValue: string | null; // Reserved for future P3 support
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
        } else if (
          trimmedLine.startsWith("@media") &&
          trimmedLine.includes("prefers-color-scheme: dark")
        ) {
          // Assume @media contains dark overrides
          currentSelectorScope = "dark";
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
              combinedParsed[variableName] = { lightValue: null, darkValue: null };
            }

            // Assign value to the correct slot (light/dark), only if not already assigned
            if (currentSelectorScope === "light") {
              if (combinedParsed[variableName].lightValue === null) {
                combinedParsed[variableName].lightValue = value;
              }
            } else {
              // Must be dark scope
              if (combinedParsed[variableName].darkValue === null) {
                combinedParsed[variableName].darkValue = value;
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
    const rgbVar = `--radix-rgb-${outputStemName}-${outputIndex}`;
    const themeVar = `--color-${outputStemName}-${outputIndex}`;

    // Always generate the Tailwind theme mapping line
    themeLines.push(`  ${themeVar}: oklch(var(${rgbVar}));`);

    // Convert and add the light mode definition if a light value exists
    if (parsedValue.lightValue) {
      let oklchString: string | null = null;
      let alphaValue: string | null = null; // To store extracted alpha from hex codes

      try {
        if (parsedValue.lightValue.startsWith("#")) {
          oklchString = hexToOklchString(parsedValue.lightValue); // This only gives L C H
          // Check if it was an 8-digit hex to extract alpha separately
          if (parsedValue.lightValue.length === 9) {
            const alphaHex = parsedValue.lightValue.slice(7);
            const alpha = parseInt(alphaHex, 16);
            if (!isNaN(alpha)) {
              alphaValue = (Math.round((alpha / 255) * 1000) / 1000).toString();
            }
          }
        } else if (parsedValue.lightValue.startsWith("hsla")) {
          oklchString = hslaStringToOklchString(parsedValue.lightValue); // Returns "L C H / A" or "L C H"
        } else if (parsedValue.lightValue.startsWith("rgba")) {
          oklchString = rgbaStringToOklchString(parsedValue.lightValue); // Returns "L C H / A" or "L C H"
        }
        // TODO: Handle p3 colors properly (conversion to OKLCH or pass through)
        // else if (parsedValue.lightValue.startsWith("color(display-p3")) { ... }
      } catch (error) {
        console.error(
          `Error converting light value for ${variableName}: ${parsedValue.lightValue}`,
          error,
        );
      }

      // Append the variable definition
      if (oklchString) {
        // If alpha was separately extracted (only for hex), append it.
        // Otherwise, oklchString already contains alpha if needed.
        const finalValue = alphaValue ? `${oklchString} / ${alphaValue}` : oklchString;
        lightRgbLines.push(`  ${rgbVar}: ${finalValue};`);
      }
    }

    // Convert and add the dark mode definition if a dark value exists
    if (parsedValue.darkValue) {
      let oklchString: string | null = null;
      let alphaValue: string | null = null; // To store extracted alpha from hex codes

      try {
        if (parsedValue.darkValue.startsWith("#")) {
          oklchString = hexToOklchString(parsedValue.darkValue); // L C H
          if (parsedValue.darkValue.length === 9) {
            const alphaHex = parsedValue.darkValue.slice(7);
            const alpha = parseInt(alphaHex, 16);
            if (!isNaN(alpha)) {
              alphaValue = (Math.round((alpha / 255) * 1000) / 1000).toString();
            }
          }
        } else if (parsedValue.darkValue.startsWith("hsla")) {
          oklchString = hslaStringToOklchString(parsedValue.darkValue); // L C H / A
        } else if (parsedValue.darkValue.startsWith("rgba")) {
          oklchString = rgbaStringToOklchString(parsedValue.darkValue); // L C H / A
        }
        // TODO: Handle p3 colors
      } catch (error) {
        console.error(
          `Error converting dark value for ${variableName}: ${parsedValue.darkValue}`,
          error,
        );
      }

      // Append the variable definition
      if (oklchString) {
        const finalValue = alphaValue ? `${oklchString} / ${alphaValue}` : oklchString;
        darkRgbLines.push(`  ${rgbVar}: ${finalValue};`);
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

  // Add dark mode block (class-based)
  if (darkRgbLines.length > 0) {
    cssContent += `\n.dark,\n.dark-theme {\n${darkRgbLines.join("\n")}\n}\n`;
  }

  // Add dark mode block (media query)
  if (darkRgbLines.length > 0) {
    cssContent += `\n@media (prefers-color-scheme: dark) {\n  :root {\n${darkRgbLines.join(
      "\n",
    )}\n  }\n}\n`;
  }

  // Add Tailwind theme mapping block
  if (themeLines.length > 0) {
    cssContent += `\n@theme inline {\n${themeLines.join("\n")}\n}\n`;
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
