import { describe, test, expect } from "bun:test";
import {
  hexToOklchString,
  rgbaStringToOklchString,
  hslaStringToOklchString,
  p3ToP3String, // Import even if tests are skipped
} from "./color-conversions";

describe("Color Conversion Utilities", () => {
  describe("hexToOklchString", () => {
    test("should convert 6-digit hex to OKLCH string", () => {
      // OKLCH values are approximate and may vary slightly based on implementation details
      expect(hexToOklchString("#FF0000")).toBe("0.628 0.258 29.234"); // Red
      expect(hexToOklchString("#00ff00")).toBe("0.866 0.295 142.495"); // Green (Approx)
      expect(hexToOklchString("#0000FF")).toBe("0.452 0.313 264.052"); // Blue (Approx)
      expect(hexToOklchString("#FFFFFF")).toBe("1 0 0"); // White
      expect(hexToOklchString("#000000")).toBe("0 0 0"); // Black
      expect(hexToOklchString("#808080")).toBe("0.6 0 0"); // Gray (Calculated value)
    });

    test("should convert 8-digit hex, ignoring alpha, to OKLCH string", () => {
      // Alpha component is ignored by hexToOklchString
      expect(hexToOklchString("#FF000080")).toBe("0.628 0.258 29.234");
      expect(hexToOklchString("#00FF00FF")).toBe("0.866 0.295 142.495");
      expect(hexToOklchString("#0000FF00")).toBe("0.452 0.313 264.052");
    });

    test("should throw error for invalid hex codes", () => {
      expect(() => hexToOklchString("#F00")).toThrow();
      expect(() => hexToOklchString("FF0000")).toThrow();
      expect(() => hexToOklchString("#GGGFFF")).toThrow(
        "Invalid hex code format (contains non-hex characters)",
      );
      expect(() => hexToOklchString("#FF00")).toThrow(); // Too short
    });
  });

  describe("rgbaStringToOklchString", () => {
    test("should convert RGBA string to OKLCH string with alpha", () => {
      expect(rgbaStringToOklchString("rgba(255, 0, 0, 0.5)")).toBe("0.628 0.258 29.234 / 0.5"); // Red 50%
      expect(rgbaStringToOklchString("rgba(0, 255, 0, 1)")).toBe("0.866 0.295 142.495"); // Green 100% (alpha omitted)
      expect(rgbaStringToOklchString("rgba(0, 0, 255, 0)")).toBe("0.452 0.313 264.052 / 0"); // Blue 0%
      expect(rgbaStringToOklchString("rgba(255, 255, 255, 0.75)")).toBe("1 0 0 / 0.75"); // White 75%
      expect(rgbaStringToOklchString("rgba(0, 0, 0, 0.25)")).toBe("0 0 0 / 0.25"); // Black 25%
    });

    test("should handle RGBA strings with spaces", () => {
      expect(rgbaStringToOklchString("rgba( 255 , 0 , 0 , 0.5 )")).toBe("0.628 0.258 29.234 / 0.5");
    });

    test("should return null for invalid RGBA strings", () => {
      expect(rgbaStringToOklchString("rgb(0, 100, 50)")).toBeNull();
      expect(rgbaStringToOklchString("rgba(0, 100, 50, 0.5, 1)")).toBeNull();
      expect(rgbaStringToOklchString("rgba(0, 100, 50)")).toBeNull();
      expect(rgbaStringToOklchString("rgba(foo, bar, baz, 0.1)")).toBeNull();
    });
  });

  describe("hslaStringToOklchString", () => {
    test("should convert HSLA string to OKLCH string with alpha", () => {
      expect(hslaStringToOklchString("hsla(0, 100%, 50%, 0.5)")).toBe("0.628 0.258 29.234 / 0.5"); // Red 50%
      expect(hslaStringToOklchString("hsla(120, 100%, 50%, 1)")).toBe("0.866 0.295 142.495"); // Green 100% (alpha omitted)
      expect(hslaStringToOklchString("hsla(240, 100%, 50%, 0)")).toBe("0.452 0.313 264.052 / 0"); // Blue 0%
      expect(hslaStringToOklchString("hsla(0, 0%, 100%, 0.75)")).toBe("1 0 0 / 0.75"); // White 75%
      expect(hslaStringToOklchString("hsla(0, 0%, 0%, 0.25)")).toBe("0 0 0 / 0.25"); // Black 25%
      expect(hslaStringToOklchString("hsla(210, 50%, 50%, 0.8)")).toBe("0.584 0.118 250.859 / 0.8"); // Grayish Blue 80%
    });

    test("should throw error for invalid HSLA strings", () => {
      expect(() => hslaStringToOklchString("hsl(0, 100%, 50%)")).toThrow(
        "Invalid HSLA string format",
      );
      expect(() => hslaStringToOklchString("hsla(0, 100, 50, 0.5)")).toThrow(
        "Invalid HSLA string format",
      );
    });
  });

  // Tests for p3ToP3String - currently just extracts string components
  describe("p3ToP3String", () => {
    test("should extract solid P3 values", () => {
      expect(p3ToP3String("color(display-p3 0.5 0.6 0.7)", false)).toBe("0.5 0.6 0.7");
    });
    test("should extract P3 values with alpha", () => {
      expect(p3ToP3String("color(display-p3 0.5 0.6 0.7 / 0.8)", true)).toBe("0.5 0.6 0.7 / 0.8");
    });
    test("should return null if alpha requirement is not met", () => {
      expect(p3ToP3String("color(display-p3 0.5 0.6 0.7)", true)).toBeNull(); // Requires alpha, none given
      expect(p3ToP3String("color(display-p3 0.5 0.6 0.7 / 0.8)", false)).toBeNull(); // Requires no alpha, alpha given
    });
    test("should return null for invalid P3 strings", () => {
      expect(p3ToP3String("color(p3 0.5 0.6 0.7)", false)).toBeNull();
      expect(p3ToP3String("display-p3 0.5 0.6 0.7", false)).toBeNull();
    });
  });
});
