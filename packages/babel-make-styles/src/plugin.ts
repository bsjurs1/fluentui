import { NodePath, PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { resolveStyleRules } from '@fluentui/make-styles';

import { astify } from './utils/astify';

type BabelPluginOptions = { types: typeof t };
type BabelPlugin = (a: BabelPluginOptions) => PluginObj;

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

const babelPlugin: BabelPlugin = () => {
  return {
    name: '@fluentui/babel-make-styles',

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
            const result = stylesPath.evaluate();

            if (!result.confident) {
              throw new Error('111');
            }
            const resolvedStyles = resolveStyleRules(result.value);
            const resolvedStylesAst = astify(resolvedStyles);
            // console.log(resolvedStyles, resolvedStylesAst);

            stylesPath.replaceWith(resolvedStylesAst);
            return;
          }

          if (stylesPath.isArrowFunctionExpression()) {
            if (stylesPath.get('params').length === 0) {
              // skip
            } else if (stylesPath.get('params').length > 1) {
              // throw
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

                // const m = new Module(filename, options);
                //
                // m.dependencies = [];
                // m.evaluate(code, ['__linariaPreval']);

                console.log(paramsName, state);
              });

              // has tokens

              // console.log(stylesPath.node);
              return;
            }
          }
        });
      },
    },
  };
};

export default babelPlugin;
