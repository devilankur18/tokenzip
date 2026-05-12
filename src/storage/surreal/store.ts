import { Surreal, createRemoteEngines, StringRecordId } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';
import { IStore } from '../interface.js';
import { GraphNode, GraphEdge, GraphResult, StoreStats } from '../../types/graph.js';
import { SCHEMA_DEFINITION } from './migrations.js';
import fs from 'fs';
import path from 'path';

export class SurrealStore implements IStore {
  private db: Surreal;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Surreal({
      engines: {
        ...createRemoteEngines(),
        ...createNodeEngines(),
      },
    });
  }

  async initialize(): Promise<void> {
    if (!this.dbPath.startsWith('mem:')) {
      const parent = path.dirname(this.dbPath);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
    }
    
    const connectionString = this.dbPath.includes('://') || this.dbPath.includes(':')
      ? this.dbPath 
      : `surrealkv:${this.dbPath}`;
    
    console.log(`Connecting to surreal db at ${connectionString}...`);
    try {
      await this.db.connect(connectionString);
      console.log('Connected to surreal db!');
      await this.db.use({ namespace: 'tokenzip', database: 'graph' });
    } catch (err) {
      console.error('SurrealDB Connection Error:', err);
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  async migrate(): Promise<void> {
    await this.db.query(SCHEMA_DEFINITION);
  }

  async clear(): Promise<void> {
    await this.db.query('REMOVE DATABASE graph;');
    await this.db.use({ namespace: 'tokenzip', database: 'graph' });
    await this.migrate();
  }

  async stats(): Promise<StoreStats> {
    const res = await this.db.query<any[]>('INFO FOR DB;');
    const tables = res[0]?.tables || {};
    
    const nodeCount: Record<string, number> = {};
    const edgeCount: Record<string, number> = {};
    
    for (const [tableName, _] of Object.entries(tables)) {
      const countRes = await this.db.query<any[][]>(`SELECT count() FROM type::table($tb) GROUP ALL`, { tb: tableName });
      const count = countRes[0]?.[0]?.count || 0;
      nodeCount[tableName] = count;
    }

    return {
      nodeCount,
      edgeCount,
      dbSizeBytes: 0,
    };
  }

  async createNode<T extends GraphNode>(node: T): Promise<T> {
    const { id, type, ...data } = node as any;
    // Remove null values since SurrealDB option type expects none (omitted) or the type
    for (const key of Object.keys(data)) {
      if (data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    }
    const recordId = typeof id === 'string' ? new StringRecordId(id) : id;
    const res = await this.db.query<T[][]>(`UPSERT type::record($id) CONTENT $data;`, { 
      id: recordId,
      data: { ...data }
    });
    return res[0][0];
  }

  async createNodes<T extends GraphNode>(nodes: T[]): Promise<T[]> {
    const results: T[] = [];
    for (const node of nodes) {
      results.push(await this.createNode(node));
    }
    return results;
  }

  async getNode<T extends GraphNode>(id: string): Promise<T | null> {
    const recordId = typeof id === 'string' ? new StringRecordId(id) : id;
    const res = await this.db.query<T[][]>('SELECT * FROM type::record($id)', { id: recordId });
    return res[0]?.[0] || null;
  }

  async getNodes(ids: string[]): Promise<GraphNode[]> {
    const results: GraphNode[] = [];
    for (const id of ids) {
      const node = await this.getNode(id);
      if (node) results.push(node);
    }
    return results;
  }

  async updateNode<T extends GraphNode>(id: string, patch: Partial<T>): Promise<T> {
    const { id: _, type, ...data } = patch as any;
    for (const key of Object.keys(data)) {
      if (data[key] === null || data[key] === undefined) {
        delete data[key];
      }
    }
    const recordId = typeof id === 'string' ? new StringRecordId(id) : id;
    const res = await this.db.query<T[][]>('UPSERT type::record($id) MERGE $data', { id: recordId, data });
    return res[0][0];
  }

  async deleteNode(id: string): Promise<void> {
    await this.db.query('DELETE type::record($id)', { id });
  }

  async deleteNodes(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteNode(id);
    }
  }

  async createEdge<T extends GraphEdge>(edge: T): Promise<T> {
    const from = typeof edge.from === 'string' ? new StringRecordId(edge.from) : edge.from;
    const to = typeof edge.to === 'string' ? new StringRecordId(edge.to) : edge.to;
    
    const res = await this.db.query<T[][]>(`RELATE $from->${edge.type}->$to CONTENT $metadata;`, {
      from,
      to,
      metadata: edge.metadata || {}
    });
    return res[0][0];
  }

  async createEdges<T extends GraphEdge>(edges: T[]): Promise<T[]> {
    const results: T[] = [];
    for (const edge of edges) {
      results.push(await this.createEdge(edge));
    }
    return results;
  }

  async getEdges(from: string, type?: string): Promise<GraphEdge[]> {
    let q = 'SELECT * FROM type::record($from)->';
    if (type) {
      q += `type::table($type)`;
    } else {
      q += '?';
    }
    const res = await this.db.query<GraphEdge[][]>(q, { from, type });
    return res[0] || [];
  }

  async getEdgesTo(to: string, type?: string): Promise<GraphEdge[]> {
    let q = 'SELECT * FROM <-';
    if (type) {
      q += `type::table($type)`;
    } else {
      q += '?';
    }
    q += '<-type::record($to)';
    const res = await this.db.query<GraphEdge[][]>(q, { to, type });
    return res[0] || [];
  }

  async deleteEdges(from: string, type?: string): Promise<void> {
    let q = 'DELETE type::record($from)->';
    if (type) q += `type::table($type)`;
    else q += '?';
    await this.db.query(q, { from, type });
  }

  async query<T = unknown>(queryStr: string, vars?: Record<string, unknown>): Promise<T[]> {
    const res = await this.db.query<T[][]>(queryStr, vars);
    return res[0] || [];
  }

  async graphTraversal(
    startId: string,
    edgeTypes: string[],
    direction: 'outbound' | 'inbound' | 'both',
    depth: number = 5,
    filter?: string
  ): Promise<GraphResult> {
    // Basic traversal approximation for now using surrealql
    const edgesList = edgeTypes.map(e => `type::table(${e})`).join(',');
    let dirOp = '->';
    if (direction === 'inbound') dirOp = '<-';
    else if (direction === 'both') dirOp = '<->';
    
    // We fetch connected nodes up to depth.
    let currentLevelIds = [startId];
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    const startNode = await this.getNode(startId);
    if (startNode) {
      nodes.push(startNode);
      visitedNodes.add(startId);
    }

    for (let d = 0; d < depth; d++) {
      if (currentLevelIds.length === 0) break;
      const q = `SELECT * FROM type::record($ids)${dirOp}(${edgesList})`;
      const edgeRes = await this.db.query<GraphEdge[][]>(q, { ids: currentLevelIds, edgesList });
      const currentEdges = edgeRes[0] || [];
      const nextLevelIds: string[] = [];
      
      for (const e of currentEdges) {
        if (!visitedEdges.has(e.id!)) {
          edges.push(e);
          visitedEdges.add(e.id!);
          
          const targetId = direction === 'inbound' ? e.in as unknown as string : e.out as unknown as string;
          if (!visitedNodes.has(targetId)) {
            const targetNode = await this.getNode(targetId);
            if (targetNode) {
              nodes.push(targetNode);
              visitedNodes.add(targetId);
              nextLevelIds.push(targetId);
            }
          }
        }
      }
      currentLevelIds = nextLevelIds;
    }

    return { nodes, edges };
  }

  async batchUpsert(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    // For simplicity, we loop. Can optimize to batch transaction
    for (const node of nodes) {
      await this.updateNode(node.id, node);
    }
    for (const edge of edges) {
      await this.createEdge(edge);
    }
  }

  async searchNodes(
    type: string,
    field: string,
    queryStr: string,
    limit: number = 10
  ): Promise<GraphNode[]> {
    const q = `SELECT * FROM type::table($type) WHERE string::lowercase(${field}) CONTAINS string::lowercase($qStr) LIMIT $limit`;
    const res = await this.db.query<GraphNode[][]>(q, { type, qStr: queryStr, limit });
    return res[0] || [];
  }

  async transaction<T>(fn: (store: IStore) => Promise<T>): Promise<T> {
    // Since Surreal embedded mode transactions are limited in JS, we just run sequentially for now.
    return await fn(this);
  }
}
