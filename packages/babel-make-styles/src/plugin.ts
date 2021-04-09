import { NodePath, PluginObj, PluginPass, types as t } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import { Module } from '@linaria/babel';

import { evaluatePaths } from './utils/evaluatePaths';
import { MakeStyles, resolveStyleRules } from '@fluentui/make-styles';
import { astify } from './utils/astify';

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

type AstStyleNode =
  | { kind: 'PURE_OBJECT'; nodePath: NodePath<t.ObjectExpression> }
  | {
      kind: 'LAZY_OBJECT';
      nodePath: NodePath<t.ObjectExpression>;
      propertyPaths: NodePath<t.Expression>[];
      spreadPaths: NodePath<t.SpreadElement>[];
    }
  | { kind: 'LAZY_IDENTIFIER'; nodePath: NodePath<t.Identifier> };

type BabelPluginState = PluginPass & {
  importDeclarationPath?: NodePath<t.ImportDeclaration>;

  /** Contains AST nodes with that should be resolved. */
  styleNodes?: AstStyleNode[];
};

export const babelPlugin = declare<never, PluginObj<BabelPluginState>>(api => {
  api.assertVersion(7);

  return {
    name: '@fluentui/babel-make-styles',

    pre() {
      this.styleNodes = [];
    },

    visitor: {
      Program: {
        enter() {
          // Invalidate cache for module evaluation to get fresh modules
          Module.invalidate();
        },

        exit(path, state) {
          if (!state.importDeclarationPath) {
            return;
          }

          const pathsToEvaluate = state.styleNodes!.reduce<NodePath<any>[]>((acc, styleNode) => {
            if (styleNode.kind === 'PURE_OBJECT') {
              return acc;
            }

            if (styleNode.kind === 'LAZY_IDENTIFIER') {
              return [...acc, styleNode.nodePath];
            }

            if (styleNode.kind === 'LAZY_OBJECT') {
              return [...acc, ...styleNode.propertyPaths, ...styleNode.spreadPaths];
            }

            throw new Error(/* TODO */);
          }, []);

          if (pathsToEvaluate.length > 0) {
            evaluatePaths(path, state.file.opts.filename!, pathsToEvaluate);
          }

          state.styleNodes?.forEach(styleNode => {
            const evaluationResult = styleNode.nodePath.evaluate();

            if (!evaluationResult.confident) {
              throw new Error(/* TODO */);
            }

            const styles: MakeStyles = evaluationResult.value;
            const resolvedStyles = resolveStyleRules(styles);

            styleNode.nodePath.replaceWith(astify(resolvedStyles));
          });

          const specifiers = state.importDeclarationPath.get('specifiers');

          specifiers.forEach(specifier => {
            if (specifier.isImportSpecifier()) {
              const imported = specifier.get('imported');

              if (imported.isIdentifier({ name: 'makeStyles' })) {
                specifier.replaceWith(t.identifier('prebuildStyles'));
              }
            }
          });

          if (state.ppp.length > 0) {
            state.ppp.forEach(callee => {
              callee.replaceWith(t.identifier('prebuildStyles'));
            });
          }
        },
      },

      ImportDeclaration(path, state) {
        if (path.node.source.value !== '@fluentui/react-make-styles') {
          return;
        }

        state.importDeclarationPath = path;
      },

      CallExpression(expressionPath, state) {
        if (!state.importDeclarationPath) {
          return;
        }

        if (!isMakeStylesCallExpression(expressionPath)) {
          return;
        }

        const p = expressionPath.findParent(p => p.isProgram());
        const args = expressionPath.get('arguments');
        const hasValidArgument = Array.isArray(args) && args.length === 1;

        if (!hasValidArgument) {
          throw new Error();
        }

        state.ppp = state.ppp || [];
        state.ppp.push(expressionPath.get('callee'));

        const definitionsPath = expressionPath.get('arguments.0') as NodePath<t.Node>;

        if (!definitionsPath.isObjectExpression()) {
          throw new Error();
        }

        const styleSlots = definitionsPath.get('properties');

        styleSlots.forEach(styleSlot => {
          if (styleSlot.isObjectProperty()) {
            const stylesPath = styleSlot.get('value');

            /**
             * Needs context-aware lazy evaluation anyway.
             *
             * @example makeStyles({ root: SOME_VARIABLE })
             */
            if (stylesPath.isIdentifier()) {
              state.styleNodes?.push({
                kind: 'LAZY_IDENTIFIER',
                nodePath: stylesPath,
              });
              return;
            }

            if (stylesPath.isObjectExpression()) {
              const propertiesPaths = stylesPath.get('properties');

              const lazyProperties: NodePath<t.Expression>[] = [];
              const lazySpreads: NodePath<t.SpreadElement>[] = [];

              propertiesPaths.forEach(propertyPath => {
                if (propertyPath.isObjectMethod()) {
                  throw new Error(/* TODO */);
                }

                if (propertyPath.isObjectProperty()) {
                  const valuePath = propertyPath.get('value');

                  if (valuePath.isStringLiteral() || valuePath.isNullLiteral() || valuePath.isNumericLiteral()) {
                    return;
                  }

                  if (valuePath.isExpression()) {
                    lazyProperties.push(valuePath);
                    return;
                  }

                  throw new Error(/* TODO */);
                }

                if (propertyPath.isSpreadElement()) {
                  lazySpreads.push(propertyPath);
                  return;
                }

                throw new Error(/* TODO */);
              });

              if (lazyProperties.length === 0 && lazySpreads.length === 0) {
                state.styleNodes?.push({
                  kind: 'PURE_OBJECT',
                  nodePath: stylesPath,
                });
                return;
              }

              state.styleNodes?.push({
                kind: 'LAZY_OBJECT',
                nodePath: stylesPath,

                propertyPaths: lazyProperties,
                spreadPaths: lazySpreads,
              });
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
                extracted(stylesPath, p, state.file.opts.filename);

                return;
              }
            }
          }

          if (styleSlot.isSpreadElement()) {
            extracted(styleSlot, p, state.file.opts.filename);
            return;
          }

          throw new Error();
        });
      },
    },
  };
});

export default babelPlugin;
