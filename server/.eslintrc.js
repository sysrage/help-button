'use strict';

module.exports = {
  extends: [
    '@phoenix35/eslint-config/node',
  ],
  rules: {
    quotes: [
      'error',
      'single',
      { avoidEscape: true },
    ],
    curly: [
      'error',
      'multi-line',
      'consistent',
    ],
    'arrow-parens': [
      'error',
      'always',
    ],
    'multiline-ternary': [
      'error',
      'always-multiline',
    ],
    'nonblock-statement-body-position': [
      'error',
      'beside',
    ],
    'no-process-exit': 0,
    'no-magic-numbers': 0,
  },
};
