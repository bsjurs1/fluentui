import { NodePath, types as t } from '@babel/core';
import { evaluatePathsInVM } from './evaluatePathsInVM';

export function evaluatePaths(program: NodePath<t.Program>, filename: string, paths: NodePath<any>[]) {
  const pathsToBeEvaluatedInVM: NodePath<any>[] = [];

  for (let i = 0; i < paths.length; i++) {
    const result = paths[i].evaluate();

    if (result.confident) {
      /* 🟢 TODO */
      continue;
    }

    pathsToBeEvaluatedInVM.push(paths[i]);
  }

  if (pathsToBeEvaluatedInVM.length > 0) {
    evaluatePathsInVM(program, filename, pathsToBeEvaluatedInVM);
  }
}
