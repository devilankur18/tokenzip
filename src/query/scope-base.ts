import { IStore } from '../storage/interface.js';
import { GraphNode, GraphEdge, GraphResult } from '../types/graph.js';

export type SortDirection = 'asc' | 'desc';
export type TerminalFormat = 'array' | 'graph' | 'markdown' | 'json';

export interface FilterPredicate {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'matches' | 'in' | 'exists';
  value: unknown;
}

export abstract class QueryScope<T extends QueryScope<T>> {
  protected filters: FilterPredicate[] = [];
  protected sortField: string | null = null;
  protected sortDir: SortDirection = 'asc';
  protected limitCount: number | null = null;
  protected offsetCount: number = 0;

  constructor(protected store: IStore, protected repoPath: string) {}

  filter(predicate: FilterPredicate): T {
    const clone = this.clone();
    clone.filters.push(predicate);
    return clone as unknown as T;
  }

  eq(field: string, value: unknown): T { return this.filter({ field, op: 'eq', value }); }
  neq(field: string, value: unknown): T { return this.filter({ field, op: 'neq', value }); }
  contains(field: string, value: string): T { return this.filter({ field, op: 'contains', value }); }
  matches(field: string, pattern: string): T { return this.filter({ field, op: 'matches', value: pattern }); }
  in(field: string, values: unknown[]): T { return this.filter({ field, op: 'in', value: values }); }

  sort(field: string, dir: SortDirection = 'asc'): T {
    const clone = this.clone();
    clone.sortField = field;
    clone.sortDir = dir;
    return clone as unknown as T;
  }

  limit(n: number): T {
    const clone = this.clone();
    clone.limitCount = n;
    return clone as unknown as T;
  }

  offset(n: number): T {
    const clone = this.clone();
    clone.offsetCount = n;
    return clone as unknown as T;
  }

  async toArray(): Promise<GraphNode[]> {
    const result = await this.execute();
    return result.nodes;
  }

  async toGraph(): Promise<GraphResult> {
    const result = await this.execute();
    return {
      nodes: result.nodes,
      edges: result.edges,
    };
  }

  async toJSON(): Promise<string> {
    const result = await this.toGraph();
    return JSON.stringify(result, null, 2);
  }

  async count(): Promise<number> {
    const nodes = await this.toArray();
    return nodes.length;
  }

  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  protected abstract execute(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  protected abstract clone(): T;
}
