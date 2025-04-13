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
  };

  test("red.css should contain correct light/dark structures and theme", async () => {
    await checkFileContent("red.css", [
      // Light mode selectors and block start
      /:root,\s*\.light,\s*\.light-theme\s*\{/s,
      // Dark mode class selectors and block start
      /\.dark,\s*\.dark-theme\s*\{/s,
      // Dark mode media query and nested :root start
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/s,
      // Theme block start
      /@theme inline\s*\{/s,

      // --- Specific Variable Checks ---
      // Base OKLCH vars
      /(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-9:/s, // Light Solid
      /(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-a9:/s, // Light Alpha
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-9:/s, // Dark Solid (class)
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-a9:/s, // Dark Alpha (class)
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-9:/s, // Dark Solid (media)
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-a9:/s, // Dark Alpha (media)

      // Intermediate oklch(var()) vars (global :root)
      /^:root\s*\{[^}]*--radix-intermediate-red-9:\s*oklch\(var\(\s*--radix-rgb-red-9\s*\)\);/ms,
      /^:root\s*\{[^}]*--radix-intermediate-red-a9:\s*oklch\(var\(\s*--radix-rgb-red-a9\s*\)\);/ms,

      // Theme Mapping Solid (--color-red-9 defined in @theme)
      /@theme inline\s*\{[^}]*--color-red-9:\s*var\(\s*--radix-intermediate-red-9\s*\);/s,
      // Theme Mapping Alpha (--color-red-a9 defined in @theme)
      /@theme inline\s*\{[^}]*--color-red-a9:\s*var\(\s*--radix-intermediate-red-a9\s*\);/s,

      // --- P3 Checks (Inside @supports / @media) ---
      // P3 :root block redefining intermediate var (using var())
      /@supports.*?@media.*?^\s*:root\s*\{[^}]*--radix-intermediate-red-9:\s*var\(\s*--radix-rgb-red-9\s*\);/ms,
      /@supports.*?@media.*?^\s*:root\s*\{[^}]*--radix-intermediate-red-a9:\s*var\(\s*--radix-rgb-red-a9\s*\);/ms,

      // P3 light selectors redefining base var with P3 color()
      /@supports.*?@media.*?(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-9:\s*color\(display-p3/s,
      /@supports.*?@media.*?(?:\:root|,.light|,.light-theme)\s*\{[^}]*--radix-rgb-red-a9:\s*color\(display-p3/s,

      // P3 dark selectors redefining base var with P3 color()
      /@supports.*?@media.*?\.dark,\s*\.dark-theme\s*\{[\s\S]*?--radix-rgb-red-9:\s*color\(display-p3/s,
      /@supports.*?@media.*?\.dark,\s*\.dark-theme\s*\{[\s\S]*?--radix-rgb-red-a9:\s*color\(display-p3/s,

      // P3 dark media query redefining base var with P3 color()
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

  // P3 tests should be skipped or removed
  test.skip("should not contain P3 definitions", async () => {
    // Logic to check for absence of @supports P3 block
  });
});
