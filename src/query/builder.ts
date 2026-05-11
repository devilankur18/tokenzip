import { IStore } from '../storage/interface.js';
import { RepoScope } from './scopes/repo-scope.js';

export * from './scope-base.js';

export function createQuery(store: IStore, repoPath: string): RepoScope {
  return new RepoScope(store, repoPath);
}
