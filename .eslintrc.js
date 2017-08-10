const finalRules = {
  /* airbnb config overrides */
  'no-underscore-dangle': [0],
  'react/jsx-filename-extension': [0],
  "import/no-extraneous-dependencies": ["error", {"devDependencies": ["**/test/**/*.js"]}],
  'class-methods-use-this': [0],
  'no-throw-literal': [0],
  'comma-dangle': ['error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    },
  ],
};

const finalPlugins = [];

let scanjsRulesConfig = null;

try {
  // eslint-disable-next-line global-require
  const scanjsConfig = require('eslint-plugin-scanjs-rules');
  scanjsRulesConfig = {};

  // bring in all the scanjs rules, prefixed with 'scanjs-rules',
  // but convert them to eslint errors instead of warnings
  Object.keys(scanjsConfig.rulesConfig).forEach((rule) => {
    scanjsRulesConfig[`scanjs-rules/${rule}`] = 1;
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.log('eslint-plugin-scanjs-rules not found, will not include scanjs rules');
}

if (scanjsRulesConfig) {
  finalPlugins.push('scanjs-rules', 'no-unsanitized');

  const noUnsanitizedRules = {
    'no-unsanitized/method': 2,
    'no-unsanitized/property': 2,
  };

  Object.assign(finalRules, scanjsRulesConfig, noUnsanitizedRules);
}

module.exports = {
  extends: 'airbnb-base',
  plugins: finalPlugins,
  rules: finalRules,
};
