# Radix Colors for Tailwind CSS

> [!WARNING]  
> This project is still in early development. It is not yet ready for production use.

Radix Colors is a great color palette for software design and development. I love its simplicity in defining one color palette for both light and dark mode. I really enjoy the time when I don't have to specify `dark:` colors anymore. The original `@radix-ui/colors` library is fully usable with Tailwind CSS (e.g. `bg-mauve-2`), but it is incompatible with Tailwind CSS alpha value injection (e.g. `bg-mauve-4/50`) because its library is originally implemented and built with Hex color format. So at the same time of enjoying the simplicity of Radix Colors, I have to give up the ability to use Tailwind CSS alpha values for getting a bunch of modified semi-transparent colors.

This library is intended to provide a simple way to integrate all benefits of Radix Colors in Tailwind CSS, including alpha values, P3 display, and composing ability. It generally parses the original library and generates a plug-able Tailwind CSS plugin.

## Usage

TBA.

## Reference

- Original palette library: https://github.com/radix-ui/colors
- Use it in Swift and SwiftUI: https://github.com/lilingxi01/radix-colors-swift
