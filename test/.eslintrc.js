module.exports = {
  env: {
    mocha: true
  },
  rules: {
    "no-unused-expressions": [0],

    /** ScanJS overrides from parent eslintrc **/
    "scanjs-rules/call_setImmediate": 0,
    "scanjs-rules/call_setTimeout": 0,
  },
};
