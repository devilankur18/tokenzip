import { QueryScope } from '../scope-base.js';
import { GraphNode, GraphEdge } from '../../types/graph.js';
import { IStore } from '../../storage/interface.js';
import { SymbolScope } from './symbol-scope.js';

export class FileScope extends QueryScope<FileScope> {
  constructor(
    store: IStore,
    repoPath: string,
    private moduleId: string | null
  ) {
    super(store, repoPath);
  }

  protected async execute(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    let query = 'SELECT * FROM file';
    const vars: Record<string, unknown> = {};
    const conditions: string[] = [];

    for (const f of this.filters) {
      const param = `f_${f.field}`;
      switch (f.op) {
        case 'eq': conditions.push(`${f.field} = $${param}`); break;
        case 'neq': conditions.push(`${f.field} != $${param}`); break;
        case 'contains': conditions.push(`string::contains(${f.field}, $${param})`); break;
      }
      vars[param] = f.value;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const nodes = await this.store.query<GraphNode>(query, vars);
    return { nodes, edges: [] };
  }

  protected clone(): FileScope {
    const cloned = new FileScope(this.store, this.repoPath, this.moduleId);
    cloned.filters = [...this.filters];
    cloned.sortField = this.sortField;
    cloned.sortDir = this.sortDir;
    cloned.limitCount = this.limitCount;
    cloned.offsetCount = this.offsetCount;
    return cloned;
  }

  symbols(): SymbolScope {
    return new SymbolScope(this.store, this.repoPath, this.moduleId);
  }
}
