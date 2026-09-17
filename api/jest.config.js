/** Unit tests for pure business logic (grading, money, installments, rules validation, guards). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/common/**/*.ts', 'src/results/grading.ts', 'src/fees/fees.service.ts'],
};
