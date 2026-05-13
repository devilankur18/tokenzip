import { Surreal, createRemoteEngines, StringRecordId } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';
import { IStore } from '../interface.js';
import { GraphNode, GraphEdge, GraphResult, StoreStats } from '../../types/graph.js';
import { SCHEMA_DEFINITION } from './migrations.js';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';

export class SurrealStore implements IStore {
  private db: Surreal;
  private dbPath: string;
  private serverProcess: ChildProcess | null = null;
  private socketPath: string | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Surreal();
  }

  async initialize(): Promise<void> {
    if (this.dbPath.startsWith('mem:')) {
      await this.db.connect(this.dbPath);
      await this.db.use({ namespace: 'tokenzip', database: 'graph' });
      return;
    }

    const parent = path.dirname(this.dbPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }

    const portPath = path.resolve(parent, 'server.port');
    const lockPath = path.resolve(parent, 'server.lock');

    // 1. Try connecting to existing server via port file
    if (fs.existsSync(portPath)) {
      try {
        const port = fs.readFileSync(portPath, 'utf8').trim();
        // console.log(`Connecting to existing server at http://127.0.0.1:${port}...`);
        await this.db.connect(`http://127.0.0.1:${port}`);
        await this.db.signin({ username: 'root', password: 'root' });
        await this.db.use({ namespace: 'tokenzip', database: 'graph' });
        return;
      } catch (err) {
        console.log('Existing server not responding, cleaning up stale port/lock...');
        try { fs.unlinkSync(portPath); } catch {}
        try { fs.unlinkSync(lockPath); } catch {}
      }
    }

    // 2. No server running, try to become the owner
    try {
      fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
    } catch (err) {
      // Check if the lock is stale
      try {
        const stalePid = parseInt(fs.readFileSync(lockPath, 'utf8').trim());
        if (isNaN(stalePid) || !this.isProcessRunning(stalePid)) {
          console.log(`Found stale lock file (PID ${stalePid} not running). Cleaning up...`);
          try { fs.unlinkSync(lockPath); } catch {}
          return this.initialize();
        }
      } catch (readErr) {
        // If we can't read it, assume it's valid for now
      }

      console.log('Another process is starting the server, waiting...');
      await new Promise(r => setTimeout(r, 2000));
      return this.initialize();
    }

    // Find a deterministic port based on the repo path
    const repoPath = path.resolve(parent, '..');
    const port = this.getDeterministicPort(repoPath);

    // console.log(`Starting background SurrealDB server on port ${port} for ${this.dbPath}...`);
    await this.startBackgroundServer(port);
    
    try {
      await this.db.connect(`http://127.0.0.1:${port}`);
      await this.db.signin({ username: 'root', password: 'root' });
      await this.db.use({ namespace: 'tokenzip', database: 'graph' });
      fs.writeFileSync(portPath, port.toString());
      // console.log('Connected to background server.');
    } catch (err) {
      console.error('Failed to connect to newly started server:', err);
      this.cleanup();
      throw err;
    }

    // Register cleanup on exit
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => { this.cleanup(); process.exit(); });
    process.on('SIGTERM', () => { this.cleanup(); process.exit(); });
  }

  private getDeterministicPort(repoPath: string): number {
    let hash = 0;
    for (let i = 0; i < repoPath.length; i++) {
      hash = ((hash << 5) - hash) + repoPath.charCodeAt(i);
      hash |= 0;
    }
    // Map to 10000-60000 range
    return 10000 + (Math.abs(hash) % 50000);
  }

  private async startBackgroundServer(port: number): Promise<void> {
    const dbDir = path.resolve(this.dbPath);
    
    this.serverProcess = spawn('surreal', [
      'start',
      '--user', 'root',
      '--pass', 'root',
      '--bind', `127.0.0.1:${port}`,
      '--default-namespace', 'tokenzip',
      '--default-database', 'graph',
      `surrealkv:${dbDir}`
    ], {
      detached: false
    });

    // Wait for the server to be ready (poll the port)
    let retries = 0;
    while (retries < 50) {
      if (await this.isPortOpen(port)) {
        return;
      }
      await new Promise(r => setTimeout(r, 200));
      retries++;
    }

    throw new Error(`Timed out waiting for SurrealDB server on port ${port}`);
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 100);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  private cleanup() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    const parent = path.dirname(this.dbPath);
    const portPath = path.resolve(parent, 'server.port');
    const lockPath = path.resolve(parent, 'server.lock');
    if (fs.existsSync(portPath)) {
      try { fs.unlinkSync(portPath); } catch {}
    }
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch {}
    }
  }

  async close(): Promise<void> {
    await this.db.close();
    this.cleanup();
  }

  async migrate(): Promise<void> {
    await this.db.query('DEFINE NAMESPACE IF NOT EXISTS tokenzip; DEFINE DATABASE IF NOT EXISTS graph;');
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
    
    // In our schema, we know which ones are relations
    const relationTables = new Set([
      'contains', 'imports', 'exports', 'calls', 'implements', 
      'inherits', 'modifies', 'reads', 'references', 'depends_on', 
      'modified_in', 'foreign_key', 'column_of', 'diagram_edge', 'workflow_transition'
    ]);

    for (const [tableName, _] of Object.entries(tables)) {
      const countRes = await this.db.query<any[][]>(`SELECT count() FROM type::table($tb) GROUP ALL`, { tb: tableName });
      const count = countRes[0]?.[0]?.count || 0;
      
      if (relationTables.has(tableName)) {
        edgeCount[tableName] = count;
      } else {
        nodeCount[tableName] = count;
      }
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
    const res = await this.db.query<T[][]>(`UPSERT type::record($id) MERGE $data;`, { 
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

  /**
   * Executes multiple statements in a single call.
   * Useful for transactions or high-volume inserts.
   */
  async batch(queryStr: string, vars?: Record<string, unknown>): Promise<any[]> {
    return await this.db.query(queryStr, vars) as any[];
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
