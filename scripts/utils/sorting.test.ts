import { describe, test, expect } from "bun:test";
import { sortVarNames } from "./sorting";

describe("Sorting Utilities", () => {
  describe("sortVarNames", () => {
    test("should sort numeric indices correctly", () => {
      const input = ["--red-10", "--red-1", "--red-2"];
      const expected = ["--red-1", "--red-2", "--red-10"];
      expect(input.sort(sortVarNames)).toEqual(expected);
    });

    test("should sort alpha indices correctly", () => {
      const input = ["--red-a10", "--red-a1", "--red-a2"];
      const expected = ["--red-a1", "--red-a2", "--red-a10"];
      expect(input.sort(sortVarNames)).toEqual(expected);
    });

    test("should sort mixed solid and alpha indices, solid first", () => {
      const input = ["--red-a1", "--red-10", "--red-1", "--red-a2"];
      const expected = ["--red-1", "--red-10", "--red-a1", "--red-a2"];
      expect(input.sort(sortVarNames)).toEqual(expected);
    });

    test("should handle variables with different stems (uses localeCompare as fallback)", () => {
      const input = ["--blue-1", "--red-10", "--blue-a1"];
      // Default string sort would be blue-1, blue-a1, red-10
      // The custom sort should also group them correctly, solid first then alpha
      // Within stems, it relies on localeCompare for now
      const expected = ["--blue-1", "--red-10", "--blue-a1"];
      expect(input.sort(sortVarNames)).toEqual(expected);
    });

    test("should handle edge cases and return stable sort", () => {
      const input = ["--plum-1", "--plum-a1", "--plum-2", "--plum-a2"];
      const expected = ["--plum-1", "--plum-2", "--plum-a1", "--plum-a2"];
      expect(input.sort(sortVarNames)).toEqual(expected);
    });
  });
});
