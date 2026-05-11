import { QueryScope } from '../scope-base.js';
import { SymbolScope } from './symbol-scope.js';
import { GraphNode, GraphEdge } from '../../types/graph.js';
import { IStore } from '../../storage/interface.js';

export class RepoScope extends QueryScope<RepoScope> {
  protected async execute(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    return { nodes: [], edges: [] };
  }

  protected clone(): RepoScope {
    const cloned = new RepoScope(this.store, this.repoPath);
    cloned.filters = [...this.filters];
    cloned.sortField = this.sortField;
    cloned.sortDir = this.sortDir;
    cloned.limitCount = this.limitCount;
    cloned.offsetCount = this.offsetCount;
    return cloned;
  }

  symbols(): SymbolScope {
    return new SymbolScope(this.store, this.repoPath, null);
  }

  symbol(name: string): SymbolScope {
    return new SymbolScope(this.store, this.repoPath, null).eq('name', name);
  }
}
