import { NodePath } from '@babel/core';
import generator from '@babel/generator';
import { expression, statement } from '@babel/template';
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
    presets: ['@babel/preset-env'],
  })!;
  return [code!, null];
};

function findFreeName(scope: Scope, name: string): string {
  // By default `name` is used as a name of the function …
  let nextName = name;
  let idx = 0;
  while (scope.hasBinding(nextName, false)) {
    // … but if there is an already defined variable with this name …
    // … we are trying to use a name like wrap_N
    idx += 1;
    nextName = `wrap_${idx}`;
  }

  return nextName;
}

function hoist(babel: Core, ex: NodePath<t.Expression | null>) {
  const Identifier = (idPath: NodePath<t.IdentifierNode>) => {
    if (!idPath.isReferencedIdentifier()) {
      return;
    }

    const binding = idPath.scope.getBinding(idPath.node.name);
    if (!binding) return;
    const { scope, path: bindingPath, referencePaths } = binding;
    // parent here can be null or undefined in different versions of babel
    if (!scope.parent) {
      // It's a variable from global scope
      return;
    }

    if (bindingPath.isVariableDeclarator()) {
      const initPath = bindingPath.get('init') as NodePath<t.Expression | null>;
      hoist(babel, initPath);
      initPath.hoist(scope);
      if (initPath.isIdentifier()) {
        referencePaths.forEach(referencePath => {
          referencePath.replaceWith(babel.types.identifier(initPath.node.name));
        });
      }
    }
  };

  if (ex.isIdentifier()) {
    return Identifier(ex);
  }

  ex.traverse({
    Identifier,
  });
}

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
  const mod = new Module(f, options);
  mod.evaluate(code, ['__linariaPreval']);

  return mod.exports['__linariaPreval'];
}

const expressionWrapperTpl = statement(`
  const %%wrapName%% = (fn) => {
    try {
      return fn();
    } catch (e) {
      return e;
    }
  };
`);

const expressionTpl = expression(`%%wrapName%%(() => %%expression%%)`);
const exportsLinariaPrevalTpl = statement(`exports.__linariaPreval = %%expressions%%`);

function addLinariaPreval(path: NodePath<Program>, lazyDeps: Array<Expression | string>): Program {
  // Constant __linariaPreval with all dependencies
  const wrapName = findFreeName(path.scope, '_wrap');

  const statements = [
    expressionWrapperTpl({ wrapName }),
    exportsLinariaPrevalTpl({
      expressions: t.arrayExpression(lazyDeps.map(expression => expressionTpl({ expression, wrapName }))),
    }),
  ];

  const programNode = path.node;
  return t.program(
    [...programNode.body, ...statements],
    programNode.directives,
    programNode.sourceType,
    programNode.interpreter,
  );
}

function extracted(stylesPath: NodePath<t.ObjectExpression>, p: NodePath<t.Program>, f) {
  const result = stylesPath.evaluate();

  if (!result.confident) {
    hoist(babel, stylesPath as NodePath<t.Expression | null>);
    const hoistedExNode = t.cloneNode(stylesPath.node);

    console.log(generator(hoistedExNode).code);

    const p1 = addLinariaPreval(p, [hoistedExNode]);
    const { code } = generator(p1);

    console.log('222', code);

    const results = evaluate(code, f);
    stylesPath.replaceWith(astify(resolveStyleRules(results[0])));
    console.log('33', results[0], generator(astify(resolveStyleRules(results[0]))).code);
    // throw new Error('Oops');

    return;
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

          if (state.ppp.length > 0) {
            state.ppp.forEach(callee => {
              callee.replaceWith(t.identifier('prebuildStyles'));
            });
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
        }
      },

      CallExpression(expressionPath, state) {
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
          if (!styleSlot.isObjectProperty()) {
            throw new Error();
          }

          const stylesPath = styleSlot.get('value');

          if (stylesPath.isObjectExpression()) {
            extracted(stylesPath, p, state.file.opts.filename);
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
        });
      },
    },
  };
});

export default babelPlugin;
