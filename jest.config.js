module.exports = {
  preset: 'ts-jest',
  roots: [
    '<rootDir>/src',
  ],
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*-test.ts',
  ],
};
