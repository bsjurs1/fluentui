import { NodePath } from '@babel/core';
import * as babel from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import * as t from '@babel/types';
import { resolveStyleRules } from '@fluentui/make-styles';

import { astify } from './utils/astify';
import { Evaluator, Module, StrictOptions } from '@linaria/babel';

function isMakeStylesCallExpression(expressionPath: NodePath<t.CallExpression>): boolean {
  const callee = expressionPath.get('callee');

  if (callee.isIdentifier()) {
    if (callee.referencesImport('@fluentui/react-make-styles', 'makeStyles')) {
      return true;
    }

    return false;
  }

  return false;
}

function getMemberExpressionIdentifier(expressionPath: NodePath<t.MemberExpression>): NodePath<t.Identifier> {
  const objectPath = expressionPath.get('object');

  if (objectPath.isIdentifier()) {
    return objectPath;
  }

  if (objectPath.isMemberExpression()) {
    return getMemberExpressionIdentifier(objectPath);
  }

  throw new Error('!!!');
}

function getMemberExpressionNames(expressionPath: NodePath<t.MemberExpression>, result: string[] = []): string[] {
  const objectPath = expressionPath.get('object');
  const propertyPath = expressionPath.get('property');

  if (objectPath.isIdentifier()) {
    // NOT THERE
  } else if (objectPath.isMemberExpression()) {
    getMemberExpressionNames(objectPath, result);
  } else {
    throw new Error('!!!');
  }

  if (propertyPath.isIdentifier()) {
    result.push(propertyPath.node.name);
  }

  return result;
}

function namesToCssVariable(names: string[]): string {
  let variable = '';

  for (let i = 0; i < names.length; i++) {
    if (i === 0) {
      variable += `var(--${names[i]}`;
    } else {
      variable += `-${names[i]}`;
    }
  }

  return `${variable})`;
}

const evaluator: Evaluator = (filename, options, text) => {
  const { code } = babel.transformSync(text, {
    filename: filename,
  })!;
  return [code!, null];
};

function evaluate(code: string, f: string) {
  const options: StrictOptions = {
    displayName: false,
    evaluate: true,

    rules: [
      {
        action: evaluator,
      },
      {
        test: /\/node_modules\//,
        action: 'ignore',
      },
    ],
    babelOptions: {},
  };
  const filename = '/foo/bar/test.js';
  const mod = new Module(filename, options);

  mod.evaluate('module.exports = () => 42');

  console.log(mod.exports());
}

function extracted(stylesPath: NodePath<t.ObjectExpression>) {
  const result = stylesPath.evaluate();

  if (!result.confident) {
    console.log(result);
    console.log(evaluate(`module.exports = () => 42`, '/foo/bar/test.js'));
    throw new Error('Oops');
  }

  const resolvedStyles = resolveStyleRules(result.value);
  const resolvedStylesAst = astify(resolvedStyles);

  stylesPath.replaceWith(resolvedStylesAst);
}

export const babelPlugin = declare<{ ooo: any }>(api => {
  api.assertVersion(7);

  return {
    name: '@fluentui/babel-make-styles',

    visitor: {
      Program: {
        exit(path, state) {
          if (state.ooo) {
            state.ooo.replaceWith(t.identifier('prebuildStyles'));
          }
        },
      },

      ImportDeclaration(expressionPath, state) {
        const source = expressionPath.get('source');

        if (source.isStringLiteral({ value: '@fluentui/react-make-styles' })) {
          const specifiers = expressionPath.get('specifiers');

          specifiers.forEach(specifier => {
            if (specifier.isImportSpecifier()) {
              const imported = specifier.get('imported');

              if (imported.isIdentifier({ name: 'makeStyles' })) {
                state.ooo = specifier;
              }
            }
          });

          console.log('!!!');
        }
      },

      CallExpression(expressionPath) {
        if (!isMakeStylesCallExpression(expressionPath)) {
          return;
        }

        const args = expressionPath.get('arguments');
        const hasValidArgument = Array.isArray(args) && args.length === 1;

        if (!hasValidArgument) {
          throw new Error();
        }

        const callee = expressionPath.get('callee');

        callee.replaceWith(t.identifier('prebuildStyles'));

        const definitionsPath = expressionPath.get('arguments.0') as NodePath<t.Node>;

        if (!definitionsPath.isObjectExpression()) {
          throw new Error();
        }

        const styleSlots = definitionsPath.get('properties');

        styleSlots.forEach(styleSlot => {
          if (!styleSlot.isObjectProperty()) {
            throw new Error();
          }

          const stylesPath = styleSlot.get('value');

          if (stylesPath.isObjectExpression()) {
            extracted(stylesPath);
            return;
          }

          if (stylesPath.isArrowFunctionExpression()) {
            if (stylesPath.get('params').length === 0) {
              // skip
            } else if (stylesPath.get('params').length > 1) {
              throw new Error('111');
            } else {
              const paramsPath = stylesPath.get('params.0') as NodePath<t.Node>;

              if (!paramsPath.isIdentifier()) {
                throw new Error('111');
              }

              const paramsName: string = paramsPath.get('name').node;

              const bodyPath = stylesPath.get('body');

              if (!bodyPath.isObjectExpression()) {
                throw new Error('111');
              }

              const properties = bodyPath.get('properties');

              properties.forEach(property => {
                if (!property.isObjectProperty()) {
                  throw new Error('111');
                }

                const valuePath = property.get('value');

                if (valuePath.isStringLiteral() || valuePath.isNullLiteral() || valuePath.isNumericLiteral()) {
                  return;
                }

                if (valuePath.isMemberExpression()) {
                  const identifierPath = getMemberExpressionIdentifier(valuePath);

                  if (identifierPath.isIdentifier({ name: paramsName })) {
                    const cssVariable = namesToCssVariable(getMemberExpressionNames(valuePath));

                    valuePath.replaceWith(t.stringLiteral(cssVariable));
                  }

                  return;
                }

                if (valuePath.isArrayExpression()) {
                  throw new Error();
                }

                throw new Error();
              });

              stylesPath.replaceWith(bodyPath);
              extracted(stylesPath);

              return;
            }
          }
        });
      },
    },
  };
});

export default babelPlugin;
