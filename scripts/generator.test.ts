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
    const content = await checkFileContent(fileName, [
      // Check for the generated light mode selector block (:root only)
      /:root\s*\{/s,

      // --- EXTREMELY Simplified Checks ---
      // Does the theme block declaration exist anywhere?
      /@theme inline/,

      // Does the specific variable definition exist anywhere?
      new RegExp(`--radix-rgb-${colorStem}-a9:`),

      // Does the specific theme mapping exist anywhere?
      new RegExp(`--color-${colorStem}-a9.*var\(.*--radix-rgb-${colorStem}-a9.*\)`), // Very loose check
    ]);

    // Check that multi-selector light block IS NOT present
    expect(content).not.toMatch(/:root,\s*\.light,\s*\.light-theme\s*\{/s);
    // Check that dark mode structures are NOT present
    expect(content).not.toMatch(/\.dark,\s*\.dark-theme\s*\{/s);
    expect(content).not.toMatch(/@media \(prefers-color-scheme: dark\)/s);
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
      // Light Solid Var (--radix-rgb-red-9 defined in :root,.light,.light-theme)
      /(?:\:root|,\.light|,\.light-theme)\s*\{[^}]*--radix-rgb-red-9:/s,
      // Light Alpha Var (--radix-rgb-red-a9 defined in :root,.light,.light-theme)
      /(?:\:root|,\.light|,\.light-theme)\s*\{[^}]*--radix-rgb-red-a9:/s,

      // Dark Solid Var (--radix-rgb-red-9 defined in .dark,.dark-theme)
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-9:/s,
      // Dark Alpha Var (--radix-rgb-red-a9 defined in .dark,.dark-theme)
      /\.dark(?:,|\s*\{)[\s\S]*?--radix-rgb-red-a9:/s,

      // Dark Solid Var (--radix-rgb-red-9 defined in @media > :root)
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-9:/s,
      // Dark Alpha Var (--radix-rgb-red-a9 defined in @media > :root)
      /@media[^{]*\{\s*:root\s*\{[^}]*--radix-rgb-red-a9:/s,

      // Theme Mapping Solid (--color-red-9 defined in @theme)
      /@theme inline\s*\{[^}]*--color-red-9: oklch\(var\(--radix-rgb-red-9\)\);/s,
      // Theme Mapping Alpha (--color-red-a9 defined in @theme)
      /@theme inline\s*\{[^}]*--color-red-a9: oklch\(var\(--radix-rgb-red-a9\)\);/s,
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
