import { Evaluator, Module, StrictOptions } from '@linaria/babel';
import { NodePath, transformSync, types as t } from '@babel/core';
import { expression, statement } from '@babel/template';
import generator from '@babel/generator';

import { astify } from './astify';
import traverse from '@babel/traverse';
import { isMakeStylesCallExpression } from './isMakeStylesCallExpression';

const EVAL_EXPORT_NAME = '__linariaPreval';

const evaluator: Evaluator = (filename, options, text) => {
  const { code } = transformSync(text, {
    filename: filename,
    presets: ['@babel/preset-env', '@babel/preset-typescript'],
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
  const mod = new Module(f, options);

  mod.evaluate(code, [EVAL_EXPORT_NAME]);

  return mod.exports[EVAL_EXPORT_NAME];
}

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

/**
 * Hoist the node and its dependencies to the highest scope possible
 *
 * @internal
 */
function hoist(ex: NodePath<t.Expression | null>) {
  const Identifier = (idPath: NodePath<t.Identifier>) => {
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

      hoist(initPath);
      initPath.hoist(scope);

      if (initPath.isIdentifier()) {
        referencePaths.forEach(referencePath => {
          referencePath.replaceWith(t.identifier(initPath.node.name));
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

function addLinariaPreval(path: NodePath<t.Program>, lazyDeps: Array<t.Expression | string>): t.Program {
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
    // Temporary solution to solve "theme" dependency
    [
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier('createCSSVariablesProxy'),
            // TODO: Should use uniq name to avoid collisions
            t.identifier('createCSSVariablesProxy'),
          ),
        ],
        t.stringLiteral('@fluentui/make-styles'),
      ),
      t.importDeclaration(
        [
          t.importSpecifier(
            t.identifier('webLightTheme'),
            // TODO: Should use uniq name to avoid collisions
            t.identifier('webLightTheme'),
          ),
        ],
        t.stringLiteral('@fluentui/react-theme'),
      ),

      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('theme'),
          t.callExpression(t.identifier('createCSSVariablesProxy'), [t.identifier('webLightTheme')]),
        ),
      ]),

      ...programNode.body,
      ...statements,
    ],
    programNode.directives,
    programNode.sourceType,
    programNode.interpreter,
  );
}

export function evaluatePathsInVM(program: NodePath<t.Program>, filename: string, nodePaths: NodePath<any>[]): void {
  const hoistedPathsToEvaluate = nodePaths.map(nodePath => {
    // save original expression that may be changed during hoisting
    const originalNode = t.cloneNode(nodePath.node);

    hoist(nodePath as NodePath<t.Expression | null>);

    // save hoisted expression to be used to evaluation
    const hoistedNode = t.cloneNode(nodePath.node);

    // get back original expression to the tree
    nodePath.replaceWith(originalNode);

    if (nodePath.isSpreadElement()) {
      return t.objectExpression([hoistedNode]);
    }

    if (nodePath.isArrowFunctionExpression()) {
      return t.callExpression(hoistedNode, [t.identifier('theme')]);
    }

    return hoistedNode;
  });

  const modifiedProgram = addLinariaPreval(program, hoistedPathsToEvaluate);

  const { code } = generator(modifiedProgram);
  console.log('CODE', code);
  const results = evaluate(code, filename);
  console.log('RESULTS', results);
  for (let i = 0; i < nodePaths.length; i++) {
    const nodePath1 = nodePaths[i];

    /* TODO */
    if (nodePath1.isSpreadElement()) {
      nodePath1.replaceWithMultiple(astify(results[i]).properties);
      continue;
    }

    nodePath1.replaceWith(astify(results[i]));
  }
}
