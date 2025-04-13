import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { describe, test, expect, beforeAll } from "bun:test";

const outputDir = path.resolve(__dirname, "../dist");

// Helper to run generator script
const runGenerator = () => {
  try {
    execSync("bun generate", { stdio: "inherit" });
  } catch (error) {
    console.error("Failed to run generator script:", error);
    throw error;
  }
};

// Helper to clean up dist directory
const cleanupDist = async () => {
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore ENOENT (file not found), rethrow others
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      console.error("Failed to clean up dist directory:", error);
      throw error;
    }
  }
};

beforeAll(async () => {
  await cleanupDist(); // Clean first
  runGenerator(); // Run generator
});

describe("Generated CSS Files", () => {
  // Helper function to read and check file content
  const checkFileContent = async (fileName: string, expectations: RegExp[]) => {
    const filePath = path.join(outputDir, fileName);
    let content = "";
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }

    expectations.forEach(expectation => {
      expect(content).toMatch(expectation);
    });
    return content;
  };

  // Reusable function for checking alpha-only files (black/white)
  const checkAlphaOnlyFile = async (baseName: string, colorStem: string) => {
    const fileName = `${baseName}.css`;
    const exampleVarBase = `--radix-rgb-${colorStem}-a9`;
    const exampleVarInter = `--radix-intermediate-${colorStem}-a9`;
    const exampleVarTheme = `--color-${colorStem}-a9`;

    const content = await checkFileContent(fileName, [
      /^:root\s*\{/m,
      new RegExp(`\{[^}]*${exampleVarBase}:`),
    ]);

    // Check that multi-selector light block IS NOT present
    expect(content).not.toMatch(/:root,\s*\.light,\s*\.light-theme\s*\{/s);
    // Check that dark mode structures ARE NOT present (for alpha files)
    expect(content).not.toMatch(/\.dark,\s*\.dark-theme\s*\{/s);
    // Check P3 dark mode structures ARE NOT present (for alpha files)
    expect(content).not.toMatch(/@supports.*?\.dark,\s*\.dark-theme\s*\{/s);
    expect(content).not.toMatch(/@supports.*?@media \(prefers-color-scheme: dark\)/s);
    // Check that P3 light mode structure IS present for alpha files (in :root)
    expect(content).toMatch(/@supports.*?@media.*?^\s*:root\s*\{[^}]*--radix-rgb-/ms);
  };

  test("red.css should contain correct light/dark/P3 structures and theme", async () => {
    await checkFileContent("red.css", [
      // --- Base Light/Dark/Theme Structures ---
      /:root,\s*\.light,\s*\.light-theme\s*\{/s, // Light mode selectors
      /\.dark,\s*\.dark-theme\s*\{/s, // Dark mode class selectors
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/s, // Dark mode media query
      /@theme inline\s*\{/s, // Theme block

      // --- Base Variable Definitions (OKLCH Fallback) ---
      // Light Solid/Alpha in :root,.light,.light-theme
      /(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-9:\s*\d/s,
      /(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-a9:\s*\d/s,
      // Dark Solid/Alpha in .dark,.dark-theme
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-9:\s*\d/s,
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-a9:\s*\d/s,
      // Dark Solid/Alpha in @media (prefers-color-scheme: dark) :root
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-9:\s*\d/s,
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-a9:\s*\d/s,

      // --- Intermediate Variable Definitions (:root global) ---
      /^:root\s*\{[^}]*--radix-intermediate-red-9:\s*oklch\(var\(--radix-rgb-red-9\)\);/ms,
      /^:root\s*\{[^}]*--radix-intermediate-red-a9:\s*oklch\(var\(--radix-rgb-red-a9\)\);/ms,

      // --- Theme Mapping (@theme) ---
      /@theme inline\s*\{[^}]*--color-red-9:\s*var\(--radix-intermediate-red-9\);/s,
      /@theme inline\s*\{[^}]*--color-red-a9:\s*var\(--radix-intermediate-red-a9\);/s,

      // --- P3 Gamut Structure Checks ---
      /@supports\s*\(color:\s*color\(display-p3\s*1\s*1\s*1\)\)\s*\{/s, // Outer @supports
      /@supports.*?@media\s*\(color-gamut:\s*p3\)\s*\{/s, // Inner @media

      // --- P3 Variable Overrides (Inside @supports / @media) ---
      // Intermediate var override in :root (using var())
      /@supports.*?@media.*?^\s*:root\s*\{[^}]*--radix-intermediate-red-9:\s*var\(--radix-rgb-red-9\);/ms,
      /@supports.*?@media.*?^\s*:root\s*\{[^}]*--radix-intermediate-red-a9:\s*var\(--radix-rgb-red-a9\);/ms,

      // Base var override in P3 light selectors (using color(display-p3 ...))
      /@supports.*?@media.*?(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-9:\s*color\(display-p3/s,
      /@supports.*?@media.*?(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-a9:\s*color\(display-p3/s,

      // Base var override in P3 dark class selectors (using color(display-p3 ...))
      /@supports.*?@media.*?\.dark,\s*\.dark-theme\s*\{[\s\S]*?--radix-rgb-red-9:\s*color\(display-p3/s,
      /@supports.*?@media.*?\.dark,\s*\.dark-theme\s*\{[\s\S]*?--radix-rgb-red-a9:\s*color\(display-p3/s,

      // Base var override in P3 dark media query (using color(display-p3 ...))
      /@supports.*?@media.*?@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*--radix-rgb-red-9:\s*color\(display-p3/s,
      /@supports.*?@media.*?@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*--radix-rgb-red-a9:\s*color\(display-p3/s,
    ]);
  });

  test("black-alpha.css should contain light structures and theme only", async () => {
    await checkAlphaOnlyFile("black-alpha", "black");
  });

  test("white-alpha.css should contain light structures and theme only", async () => {
    await checkAlphaOnlyFile("white-alpha", "white");
  });
});
