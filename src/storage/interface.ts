import { GraphNode, GraphEdge, GraphResult, StoreStats } from '../types/graph.js';

export interface IStore {
  // Lifecycle
  initialize(): Promise<boolean>;
  close(): Promise<void>;
  migrate(): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<StoreStats>;

  // Node CRUD
  createNode<T extends GraphNode>(node: T): Promise<T>;
  createNodes<T extends GraphNode>(nodes: T[]): Promise<T[]>;
  getNode<T extends GraphNode>(id: string): Promise<T | null>;
  getNodes(ids: string[]): Promise<GraphNode[]>;
  updateNode<T extends GraphNode>(id: string, patch: Partial<T>): Promise<T>;
  deleteNode(id: string): Promise<void>;
  deleteNodes(ids: string[]): Promise<void>;

  // Edge CRUD
  createEdge<T extends GraphEdge>(edge: T): Promise<T>;
  createEdges<T extends GraphEdge>(edges: T[]): Promise<T[]>;
  getEdges(from: string, type?: string): Promise<GraphEdge[]>;
  getEdgesTo(to: string, type?: string): Promise<GraphEdge[]>;
  deleteEdges(from: string, type?: string): Promise<void>;

  // Graph Queries
  query<T = unknown>(queryStr: string, vars?: Record<string, unknown>): Promise<T[]>;
  graphTraversal(
    startId: string,
    edgeTypes: string[],
    direction: 'outbound' | 'inbound' | 'both',
    depth?: number,
    filter?: string
  ): Promise<GraphResult>;

  // Bulk Operations
  batch(queryStr: string, vars?: Record<string, unknown>): Promise<any[]>;
  batchUpsert(nodes: GraphNode[], edges: GraphEdge[]): Promise<void>;

  // Search
  searchNodes(
    type: string,
    field: string,
    queryStr: string,
    limit?: number
  ): Promise<GraphNode[]>;

  // Transactions
  transaction<T>(fn: (store: IStore) => Promise<T>): Promise<T>;
}
