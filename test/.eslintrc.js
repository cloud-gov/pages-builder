module.exports = {
  env: {
    mocha: true,
  },
  rules: {
    'no-unused-expressions': [0],
    'no-only-tests/no-only-tests': 'error',
  },
  plugins: [
    'no-only-tests',
  ],
};
