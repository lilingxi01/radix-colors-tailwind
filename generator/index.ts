import fs from 'fs';
import path from 'path';
import { headerComment } from './header-comment.ts';

const outputDir = 'dist';

/**
 * This function is used to parse a color string from Radix Hex Colors to RGB colors that can be combined with transparency.
 * @param hexCode - The value of a Radix Color (in hex code, e.g. `#FF0000`).
 * @return - The RGB color string (e.g. `255 0 0`).
 */
function hexToRgb(hexCode: string): string {
  // Validate hex code format.
  if (!hexCode.startsWith('#') || (hexCode.length !== 7 && hexCode.length !== 9)) {
    throw new Error('Invalid hex code format');
  }

  // Remove the leading "#".
  const hexValue = hexCode.slice(1);
  // Convert hex pairs to decimal values.
  const matches = hexValue.match(/.{2}/g);
  if (!matches) {
    throw new Error('Invalid hex code format');
  }
  const [r, g, b, a] = matches.map((hexPair) => parseInt(hexPair, 16));
  if (a) {
    const roundedAlphaValue = Math.round(a / 255 * 1000) / 1000;
    return [r, g, b].join(' ') + ' / ' + roundedAlphaValue;
  }
  return [r, g, b].join(' ');
}

async function main() {
  // Get a list of files in package `@radix-ui/colors`.
  const __dirname = path.resolve();
  const radixPackagePath = require.resolve('@radix-ui/colors');
  // Get relative path to the current execution path instead of using pure absolute path, and remove ending `index.js` from the path.
  let radixRelativePackagePath = path.relative(__dirname, radixPackagePath);
  radixRelativePackagePath = radixRelativePackagePath.replace(/index\.js$/, '');

  // Only get `.css` files from the package files.
  const files = fs.readdirSync(radixRelativePackagePath).filter((file) => file.endsWith('.css'));

  // Create the output directory if it does not exist.
  const outputDirPath = path.join(__dirname, outputDir);
  if (!fs.existsSync(outputDirPath)) {
    fs.mkdirSync(outputDirPath);
  }

  if (!files.length) {
    throw new Error('No CSS files found in package `@radix-ui/colors`. It is probably broken after updating the package.');
  }

  const radixCssMatchingRegex = /^--(\w+)-(\w+):\s*(#\w+);$/;
  const radixP3MatchingRegex = /^--(\w+)-(\w+):\s*color\(display-p3 (\d+\.?\d*) (\d+\.?\d*) (\d+\.?\d*)(?: \/ (\d+\.?\d*))?\);$/;

  // Process all available files.
  for (const currentFilename of files) {
    const currentFilePath = path.join(radixRelativePackagePath, currentFilename);
    const currentFile = Bun.file(currentFilePath);
    const currentText = await currentFile.text();
    if (!currentText) {
      console.error('No text found in file: ' + currentFilePath);
      continue;
    }
    const lines: string[] = currentText.split('\n');
    const newLines: string[] = [];

    for (const line of lines) {
      const leadingSpaces = line.match(/^\s+/)?.[0] ?? '';
      const lineWithoutLeadingSpaces = line.replace(/^\s+/, '');
      if (!lineWithoutLeadingSpaces || !lineWithoutLeadingSpaces.startsWith('--')) {
        newLines.push(line);
        continue;
      }
      if (leadingSpaces.length <= 2) {
        const matches = lineWithoutLeadingSpaces.match(radixCssMatchingRegex);
        if (!matches || matches.length < 4) { // Check if the line is a valid color line.
          newLines.push(line);
          continue;
        }
        const colorName = matches[1];
        const colorIndex = matches[2];
        const colorValue = matches[3];
        if (!colorName || !colorIndex || !colorValue) { // Check if any of the values are missing.
          console.error('Invalid color values: ' + line);
          throw new Error('Invalid color values at file: ' + currentFilePath);
        }
        const convertedColorValue = hexToRgb(colorValue);
        const newLine = leadingSpaces + '--radix-rgb-' + colorName + '-' + colorIndex + ': ' + convertedColorValue + ';';
        newLines.push(newLine);
        continue;
      }
      const matches = lineWithoutLeadingSpaces.match(radixP3MatchingRegex);
      if (!matches || matches.length < 5) { // Check if the line is a valid color line.
        newLines.push(line);
        continue;
      }
      const colorName = matches[1];
      const colorIndex = matches[2];
      const r = matches[3];
      const g = matches[4];
      const b = matches[5];
      const a = matches[6];
      if (!r || !g || !b) { // Check if any of the values are missing.
        console.error('Invalid color values: ' + line);
        throw new Error('Invalid color values at file: ' + currentFilePath);
      }
      const convertedColorValue = r + ' ' + g + ' ' + b + (a ? (' / ' + a) : '');
      const newLine = leadingSpaces + '--radix-p3-' + colorName + '-' + colorIndex + ': ' + convertedColorValue + ';';
      newLines.push(newLine);
    }

    const newFilePath = path.join(outputDirPath, currentFilename);
    await Bun.write(newFilePath, headerComment + '\n\n' + newLines.join('\n'));
  }
}

main();
