/**
 * Custom sort comparator for Radix variable names.
 * Sorts numerically by index (1-12) then alphabetically by alpha index (a1-a12).
 * Ensures non-alpha comes before alpha.
 */
export function sortVarNames(a: string, b: string): number {
  const varRegex = /^--[a-z]+(?:-[a-z]+)*-(\d+|a\d+)$/; // Added missing '--'
  const aMatch = a.match(varRegex);
  const bMatch = b.match(varRegex);

  // Fallback to localeCompare if regex doesn't match (shouldn't happen with --prefix-index format)
  if (!aMatch || !bMatch || !aMatch[1] || !bMatch[1]) {
    return a.localeCompare(b);
  }

  const aIndex = aMatch[1];
  const bIndex = bMatch[1];
  const aIsAlpha = aIndex.startsWith("a");
  const bIsAlpha = bIndex.startsWith("a");

  // Group solid and alpha separately (solid first)
  if (aIsAlpha !== bIsAlpha) {
    return aIsAlpha ? 1 : -1;
  }

  // Sort by number within each group
  const numA = parseInt(aIsAlpha ? aIndex.substring(1) : aIndex, 10);
  const numB = parseInt(bIsAlpha ? bIndex.substring(1) : bIndex, 10);

  // Handle potential NaN from parseInt if format is unexpected
  if (isNaN(numA) || isNaN(numB)) {
    return a.localeCompare(b);
  }

  return numA - numB;
}
