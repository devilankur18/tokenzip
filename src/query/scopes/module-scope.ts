import { QueryScope } from '../scope-base.js';
import { GraphNode, GraphEdge } from '../../types/graph.js';
import { IStore } from '../../storage/interface.js';
import { FileScope } from './file-scope.js';

export class ModuleScope extends QueryScope<ModuleScope> {
  constructor(
    store: IStore,
    repoPath: string,
    private parentScopeId: string | null
  ) {
    super(store, repoPath);
  }

  protected async execute(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    return { nodes: [], edges: [] };
  }

  protected clone(): ModuleScope {
    const cloned = new ModuleScope(this.store, this.repoPath, this.parentScopeId);
    cloned.filters = [...this.filters];
    cloned.sortField = this.sortField;
    cloned.sortDir = this.sortDir;
    cloned.limitCount = this.limitCount;
    cloned.offsetCount = this.offsetCount;
    return cloned;
  }

  files(): FileScope {
    return new FileScope(this.store, this.repoPath, null);
  }
}
