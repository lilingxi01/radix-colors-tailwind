/**
 * Transform one radix color to a CSS color value used in Tailwind CSS config.
 * @param {string} familyName - The family name of the radix color. If it is an alpha color, the family name should end with `Alpha`, such as `redAlpha`.
 * @param {number} number - The number of the radix color.
 */
export function transformOneRadixColor(familyName: string, number: number): string {
  const isAlpha = familyName.endsWith("Alpha");
  const cleanedFamilyName = familyName.replace(/Alpha$/, "");
  const cleanedNumber = (isAlpha ? `a${number}` : number).toString();
  return isAlpha
    ? `rgb(var(--radix-rgb-${cleanedFamilyName}-${cleanedNumber}))`
    : `rgb(var(--radix-rgb-${cleanedFamilyName}-${cleanedNumber}) / <alpha-value>)`;
}

type RadixColorsTransformedFamily = {
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  9: string;
  10: string;
  11: string;
  12: string;
};

/**
 * Transform all radix colors (of a family) to CSS color values used in Tailwind CSS config.
 * @param familyName - The family name of the radix color. If it is an alpha color, the family name should end with `Alpha`, such as `redAlpha`.
 */
export function transformRadixColors(familyName: string): RadixColorsTransformedFamily {
  const isAlpha = familyName.endsWith("Alpha");
  const cleanedFamilyName = familyName.replace(/Alpha$/, "");
  return Array.from({ length: 12 }, (_, i) => i + 1).reduce((acc, number) => {
    const cleanedNumber = (isAlpha ? `a${number}` : number).toString();
    return {
      ...acc,
      [number]: `rgb(var(--radix-rgb-${cleanedFamilyName}-${cleanedNumber}) / <alpha-value>)`,
    };
  }, {} as RadixColorsTransformedFamily);
}

type RadixColorsTransformedWithAlphaFamily = RadixColorsTransformedFamily & {
  a1: string;
  a2: string;
  a3: string;
  a4: string;
  a5: string;
  a6: string;
  a7: string;
  a8: string;
  a9: string;
  a10: string;
  a11: string;
  a12: string;
};

/**
 * Transform all radix colors (of a family, including corresponding alpha family) to CSS color values used in Tailwind CSS config.
 * @param familyName - The family name of the radix color. It should not accept any family name ending with `Alpha` because it will be included by default.
 */
export function transformRadixColorsWithAlpha(
  familyName: string,
): RadixColorsTransformedWithAlphaFamily {
  return Array.from({ length: 12 }, (_, i) => i + 1).reduce((acc, number) => {
    return {
      ...acc,
      [number]: `rgb(var(--radix-rgb-${familyName}-${number}) / <alpha-value>)`,
      [`a${number}`]: `rgb(var(--radix-rgb-${familyName}-a${number}))`,
    };
  }, {} as RadixColorsTransformedWithAlphaFamily);
}
