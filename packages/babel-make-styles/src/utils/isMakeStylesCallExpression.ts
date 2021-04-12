import { NodePath, types as t } from '@babel/core';

export function isMakeStylesCallExpression(expressionPath: NodePath<t.CallExpression>): boolean {
  const callee = expressionPath.get('callee');

  if (callee.isIdentifier()) {
    return callee.referencesImport('@fluentui/react-make-styles', 'makeStyles');
  }

  return false;
}
