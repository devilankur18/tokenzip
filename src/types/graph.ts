export interface GraphNode {
  id: string;
  type: 'repository' | 'module' | 'file' | 'symbol' | 'commit' | 'dependency';
  [key: string]: unknown;
}

export interface GraphEdge {
  id?: string;
  type: string;
  from: string;
  to: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface StoreStats {
  nodeCount: Record<string, number>;
  edgeCount: Record<string, number>;
  dbSizeBytes: number;
}
