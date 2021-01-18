import pluginTester, { prettierFormatter } from 'babel-plugin-tester';
import * as path from 'path';

import babelPlugin from './plugin';
// console.log({
//   ...require('../../../../prettier.config.js'),
//   parser: 'typescript',
// });
pluginTester({
  babelOptions: {
    parserOpts: {
      plugins: [['typescript', { isTsx: false }]],
    },
  },

  fixtures: path.join(__dirname, '__fixtures__'),
  plugin: babelPlugin,

  formatResult: (code) =>
    prettierFormatter(code, {
      config: {
        ...require('../../../../prettier.config.js'),
        parser: 'typescript',
        arrowParens: 'avoid',
      },
    }),
});
