# Radix Colors for Tailwind CSS

> [!WARNING]  
> This project is still in early development. It is not yet ready for production use.

Radix Colors is a great color palette for software design and development. I love its simplicity in defining one color palette for both light and dark mode. I really enjoy the time when I don't have to specify `dark:` colors anymore. The original `@radix-ui/colors` library is fully usable with Tailwind CSS (e.g. `bg-mauve-2`), but it is incompatible with Tailwind CSS alpha value injection (e.g. `bg-mauve-4/50`) because its library is originally implemented and built with Hex color format. So at the same time of enjoying the simplicity of Radix Colors, I have to give up the ability to use Tailwind CSS alpha values for getting a bunch of modified semi-transparent colors.

This library is intended to provide a simple way to integrate all benefits of Radix Colors in Tailwind CSS, including alpha values, P3 display, and composing ability. It generally parses the original library and generates a plug-able Tailwind CSS plugin.

## Why Radix Colors when Tailwind CSS already has a color palette?

The default color palette of Tailwind CSS is great, but it is not efficient to build, and it usually makes your code long and unmaintainable.

* With Tailwind CSS Color Palette: `text-gray-900 bg-gray-100 dark:text-gray-100 dark:bg-gray-900`
* With Radix Colors: `text-mauve-12 bg-mauve-1`

Above classes are nearly equivalent in both light and dark mode. But the first one is much longer and harder to maintain.

It is also not quite clear what color to map with in dark mode because the original color palette of Tailwind CSS is designed to be used interchangeably in both light and dark mode. For example, `gray-100` is a light color and `gray-900` is a dark color. It is not clear what color to use in dark mode for `gray-50` because there is no `gray-950`.

But with Radix Colors, the dark mode colors are uniquely-selected and well-crafted. You don't have to worry about what color to use in dark mode, and you don't have to define them again. You can still specify a dark-mode color explicitly when you need to, but it becomes super rare to do so.

## Why Radix Colors for Tailwind CSS instead of the original library?

The CSS files in the [original Radix Colors library](https://github.com/radix-ui/colors) is all built with Hex color format. It is usable, but it loses the great ability of Tailwind CSS to inject alpha values. For example, you can't use `bg-mauve-4/50` to get a semi-transparent color from `bg-mauve-4`. This library is intended to solve this problem and further with P3 display support (including P3 display with alpha value injection).

## Usage

TBA.

## Reference

- Original palette library: https://github.com/radix-ui/colors
- Use it in Swift and SwiftUI: https://github.com/lilingxi01/radix-colors-swift
