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

export function transformRadixColors(familyName: string): RadixColorsTransformedFamily {
  return Array.from({ length: 12 }, (_, i) => i + 1).reduce((acc, number) => {
    return {
      ...acc,
      [number]: `rgb(var(--radix-rgb-${familyName}-${number}) / <alpha-value>)`,
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

export function transformRadixColorsWithAlpha(familyName: string): RadixColorsTransformedWithAlphaFamily {
  return Array.from({ length: 12 }, (_, i) => i + 1).reduce((acc, number) => {
    return {
      ...acc,
      [number]: `rgb(var(--radix-rgb-${familyName}-${number}) / <alpha-value>)`,
      [`a${number}`]: `rgb(var(--radix-rgb-${familyName}-a${number}))`,
    };
  }, {} as RadixColorsTransformedWithAlphaFamily);
}
