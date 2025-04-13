/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"], // Look for test files ending in .test.ts
  moduleNameMapper: {
    // If you have path aliases in tsconfig.json, map them here
    // Example: '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverage: true, // Enable coverage collection
  coverageDirectory: "coverage", // Directory for coverage reports
  coverageProvider: "v8", // Use V8 for coverage
  // Add any other specific Jest configurations here
};
