/*
To use this with VSCode, install the ESLint extension and add the following to
the current workspace settings:

{
    "eslint.workingDirectories": [
        { "directory": "./Code/tset-indexer/client", "changeProcessCWD": true },
        { "directory": "./Code/tset-indexer/server", "changeProcessCWD": true },
    ]
}

*/

module.exports = {
  extends: "airbnb-base",
  parserOptions: {
    ecmaVersion: 2017
  },
  env: {
    es6: true
  },
  rules: {
    // "linebreak-style": 0,
    // "new-cap": 0,
    // "no-unused-vars": 0,
    // "no-extra-semi": 0,
    // "max-len": 0,
    // "no-shadow": [
    //   'error',
    //   {
    //     allow: ['done','error','cb','result','results'],
    //   }
    // ],
    // "no-nested-ternary": 0,
    // "no-console": 0,
    // "consistent-return": 0,
    // "global-require": 0,
    // "no-else-return": 0,
    // "no-underscore-dangle": 0,
    // "array-callback-return": 0,
    // "import/newline-after-import": 0,
  }
};
