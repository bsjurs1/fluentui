import { NodePath, PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { Module } from '@linaria/babel';

import { resolveStyleRules } from '../runtime/resolveStyleRules';
import { astify } from './astify';

type BabelPluginOptions = { types: typeof t };
type BabelPlugin = (a: BabelPluginOptions) => PluginObj;

function isMakeStylesCallExpression(expressionPath: NodePath<t.CallExpression>): boolean {
  const callee = expressionPath.get('callee');

  if (callee.isIdentifier()) {
    if (callee.referencesImport('@fluentui/make-styles', 'makeStyles')) {
      return true;
    }

    return false;
  }

  return false;
}

const babelPlugin: BabelPlugin = () => {
  return {
    name: '@fluentui/make-styles/babel',

    visitor: {
      CallExpression(expressionPath, state) {
        if (!isMakeStylesCallExpression(expressionPath)) {
          return;
        }

        const args = expressionPath.get('arguments');
        const hasValidArgument = Array.isArray(args) && args.length === 1;

        if (!hasValidArgument) {
          throw new Error();
        }

        const definitionsPath = expressionPath.get('arguments.0');

        if (!definitionsPath.isArrayExpression()) {
          throw new Error();
        }

        const elements = definitionsPath.get('elements');

        elements.forEach((elementPath: NodePath<t.ArrayExpression>) => {
          if (!elementPath.isArrayExpression()) {
            throw new Error();
          }

          const elements = elementPath.get('elements');

          if (elements.length !== 2) {
            throw new Error(111);
          }

          const selectorPath = elements[0];
          const stylesPath = elements[1];

          if (!selectorPath.isNullLiteral() && !selectorPath.isFunctionExpression()) {
            throw new Error(111);
          }

          if (stylesPath.isArrowFunctionExpression()) {
            if (stylesPath.get('params').length === 0) {
              // skip
            } else if (stylesPath.get('params').length > 1) {
              // throw
            } else {
              const paramsPath = stylesPath.get('params.0');

              if (!paramsPath.isIdentifier()) {
                throw new Error(1);
              }

              const paramsName: string = paramsPath.get('name').node;

              const bodyPath = stylesPath.get('body');

              if (!bodyPath.isObjectExpression()) {
                throw new Error(111);
              }

              const properties = bodyPath.get('properties');

              properties.forEach((property) => {
                if (!property.isObjectProperty()) {
                  throw new Error(111);
                }

                // const m = new Module(filename, options);
                //
                // m.dependencies = [];
                // m.evaluate(code, ['__linariaPreval']);

                console.log(paramsName, state);
              });

              // has tokens

              // console.log(stylesPath.node);
            }
          } else if (stylesPath.isObjectExpression()) {
            // const m = new Module(state.file.opts.filename, {});
            //
            // m.dependencies = [];
            // const message = m.evaluate(``, []);
            const result = stylesPath.evaluate();

            if (!result.confident) {
              throw new Error(111);
            }
            const resolvedStyles = resolveStyleRules(result.value);
            const resolvedStylesAst = astify(resolvedStyles);
            // console.log(resolvedStyles, resolvedStylesAst);

            stylesPath.replaceWith(t.nullLiteral());
            elementPath.pushContainer('elements', resolvedStylesAst);
          } else {
            throw new Error();
          }
        });
      },
    },
  };
};

export default babelPlugin;
