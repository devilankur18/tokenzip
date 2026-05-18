import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Surreal } from 'surrealdb';
import { 
  Search, 
  Maximize2, 
  Zap, 
  Activity, 
  FileCode, 
  ChevronRight, 
  Maximize, 
  Info,
  ZoomIn,
  ZoomOut,
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  BarChart3,
  Code2
} from 'lucide-react';
import './App.css';
import Playground from './components/Playground';

interface Node {
  id: string;
  type: string;
  name: string;
  path?: string;
  signature?: string;
  docs?: string;
  val: number;
  color?: string;
  sizeBytes?: number;
  lineCount?: number;
  outDegree?: number;
  hasMemory?: boolean;
}


interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
}

const App: React.FC = () => {
  const [db, setDb] = useState<Surreal | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Edge[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ name: string; path: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [appMode, setAppMode] = useState<'graph' | 'playground'>(
    (new URLSearchParams(window.location.search).get('view') as any) || 'graph'
  );
  const [selectedPlaygroundFile, setSelectedPlaygroundFile] = useState<string | null>(
    new URLSearchParams(window.location.search).get('file')
  );
  const [searchTypeFilter, setSearchTypeFilter] = useState<'all' | 'file' | 'symbol'>('all');
  const [filters, setFilters] = useState({
    nodes: { file: true, symbol: true, module: true },
    edges: { calls: true, contains: true, imports: true, implements: true, exports: true, references: true, depends_on: true }
  });
  const fgRef = useRef<any>(null);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{ id: string | null, title: string, summary: string, category: string, priority: string }>({ 
    id: null, title: '', summary: '', category: 'guideline', priority: 'normal' 
  });
  const [pathfindingMode, setPathfindingMode] = useState<{ active: boolean, start: string | null, end: string | null }>({
    active: false, start: null, end: null
  });
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const [cycleNodes, setCycleNodes] = useState<Set<string>>(new Set());

  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'normal' | 'tokens' | 'complexity'>('normal');
  const [isRecordingPath, setIsRecordingPath] = useState(false);
  const [recordedPath, setRecordedPath] = useState<string[]>([]);
  
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  const urlParams = new URLSearchParams(window.location.search);
  const dbPort = urlParams.get('port') || '8000';

  useEffect(() => {
    const initDb = async () => {
      const surreal = new Surreal();
      try {
        await surreal.connect(`http://127.0.0.1:${dbPort}`);
        await surreal.signin({ username: 'root', password: 'root' });
        await surreal.use({ namespace: 'tokenzip', database: 'graph' });
        setDb(surreal);
        (window as any).db = surreal;
        fetchData(surreal);
      } catch (err) {
        console.error('Failed to connect to SurrealDB:', err);
        setLoading(false);
      }
    };

    initDb();
  }, [dbPort]);

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', appMode);
    if (selectedPlaygroundFile) params.set('file', selectedPlaygroundFile);
    else params.delete('file');
    
    // Preserve existing params like 'port'
    if (dbPort && !params.has('port')) params.set('port', dbPort);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  }, [appMode, selectedPlaygroundFile]);

  const fetchData = async (surreal: Surreal) => {
    try {
      // Check if tables exist first by querying INFO FOR DB
      try {
        await surreal.query(`INFO FOR DB;`);
      } catch (e: any) {
        // Ignore INFO errors if any
      }

      // Progressive Loading: Load files, modules and their architectural relationships
      const res = await surreal.query<any[][]>(`
        SELECT id, path, size_bytes, line_count, count(->tagged_with) > 0 AS has_memory FROM file LIMIT 5000;
        SELECT id, name, path, count(->tagged_with) > 0 AS has_memory FROM module LIMIT 1000;
        SELECT id, in as source, out as target FROM imports, exports, depends_on, contains LIMIT 50000;
        SELECT name, path FROM repository LIMIT 1;
      `);
      
      const files = res[0] || [];
      const modules = res[1] || [];
      const rawEdges = res[2] || [];
      const repo = res[3]?.[0];

      if (repo) setRepoInfo(repo);

      const nodes: Node[] = [
        ...files.map((n: any) => ({
          id: n.id.toString(),
          type: 'file',
          name: n.path.split('/').pop() || n.path,
          path: n.path,
          sizeBytes: n.size_bytes,
          lineCount: n.line_count,
          val: 8,
          color: '#6366f1',
          hasMemory: n.has_memory
        })),
        ...modules.map((n: any) => ({
          id: n.id.toString(),
          type: 'module',
          name: n.name || n.path?.split('/').pop() || n.id.toString(),
          path: n.path,
          val: 12,
          color: '#10b981',
          hasMemory: n.has_memory
        }))
      ];

      const nodeIds = new Set(nodes.map(n => n.id));
      const links: Edge[] = rawEdges
        .map((e: any) => ({
          id: e.id.toString(),
          source: e.source.toString(),
          target: e.target.toString(),
          type: e.type || e.id.toString().split(':')[0]
        }))
        .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

      // US.3: Dependency Heatmap - Calculate In-Degree
      // US.8: Complexity Overlay - Calculate Out-Degree
      const inDegreeMap: Record<string, number> = {};
      const outDegreeMap: Record<string, number> = {};
      links.forEach(l => {
        inDegreeMap[l.target] = (inDegreeMap[l.target] || 0) + 1;
        outDegreeMap[l.source] = (outDegreeMap[l.source] || 0) + 1;
      });

      const scaledNodes = nodes.map(n => ({
        ...n,
        outDegree: outDegreeMap[n.id] || 0,
        val: n.type === 'module' ? 14 : (8 + (inDegreeMap[n.id] || 0) * 1.5)
      }));

      setGraphData({ nodes: scaledNodes, links });
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching graph data:', err);
      if (err.message && err.message.includes('not exist')) {
        setError('Codebase not indexed. Please run `tokenzip parse` in your repository.');
      } else {
        setError(`Failed to load graph: ${err.message}`);
      }
      setLoading(false);
    }
  };

  const [searchResults, setSearchResults] = useState<Node[]>([]);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    if (!searchTerm || !db) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = searchTerm.toLowerCase();
        let queryStr = '';
        if (searchTypeFilter === 'all') {
          queryStr = 'SELECT id, name, path FROM symbol WHERE string::lowercase(name) CONTAINS $q LIMIT 15; SELECT id, path FROM file WHERE string::lowercase(path) CONTAINS $q LIMIT 15;';
        } else if (searchTypeFilter === 'file') {
          queryStr = 'SELECT id, path FROM file WHERE string::lowercase(path) CONTAINS $q LIMIT 25;';
        } else {
          queryStr = 'SELECT id, name, path FROM symbol WHERE string::lowercase(name) CONTAINS $q LIMIT 25;';
        }

        const res = await db.query<any[][]>(queryStr, { q: query });
        
        const getNodes = (data: any, type: 'symbol' | 'file') => {
          const list = Array.isArray(data) ? data : (data?.result || []);
          return list.map((n: any) => ({
            ...n,
            id: n.id.toString(),
            type,
            name: type === 'symbol' ? n.name : (n.path.split('/').pop() || n.path),
            path: n.path
          }));
        };

        let results: any[] = [];
        if (searchTypeFilter === 'all') {
          results = [...getNodes(res[0], 'symbol'), ...getNodes(res[1], 'file')];
        } else {
          results = getNodes(res[0], searchTypeFilter as any);
        }

        setSearchResults(results.slice(0, 20));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm, db, searchTypeFilter]);

  const handleSelectSearchResult = (node: Node) => {
    // Add to graph if not present
    if (!graphData.nodes.find(n => n.id === node.id)) {
      setGraphData(prev => ({
        ...prev,
        nodes: [...prev.nodes, node]
      }));
    }
    setSelectedNode(node);
    setSearchTerm('');
    setSearchResults([]);
    
    // Center view on node
    setTimeout(() => {
      if (fgRef.current) {
        const n = graphData.nodes.find(gn => gn.id === node.id) || node;
        fgRef.current.centerAt((n as any).x || 0, (n as any).y || 0, 1000);
        fgRef.current.zoom(2, 1000);
      }
    }, 100);
  };


  const visibleData = useMemo(() => {
    let nodes = graphData.nodes.filter(n => (filters.nodes as any)[n.type]);
    
    // If we have search matches, we only show those and their direct neighbors
    if (searchResults.length > 0) {
      const matchIds = new Set(searchResults.map(s => s.id));
      const relatedLinks = graphData.links.filter(l => 
        matchIds.has(typeof l.source === 'object' ? (l.source as any).id : l.source) || 
        matchIds.has(typeof l.target === 'object' ? (l.target as any).id : l.target)
      );
      const relatedNodeIds = new Set([
        ...searchResults.map(s => s.id),
        ...relatedLinks.map(l => typeof l.source === 'object' ? (l.source as any).id : (l.source as string)),
        ...relatedLinks.map(l => typeof l.target === 'object' ? (l.target as any).id : (l.target as string))
      ]);
      nodes = nodes.filter(n => relatedNodeIds.has(n.id));
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const links = graphData.links.filter(l => 
      (filters.edges as any)[l.type] &&
      nodeIds.has(typeof l.source === 'object' ? (l.source as any).id : l.source) &&
      nodeIds.has(typeof l.target === 'object' ? (l.target as any).id : l.target)
    );

    return { nodes, links };
  }, [graphData, filters, searchResults]);

  const toggleFilter = (category: 'nodes' | 'edges', type: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: {
        ...(prev as any)[category],
        [type]: !(prev as any)[category][type]
      }
    }));
  };

  const [edgeStats, setEdgeStats] = useState<Record<string, { in: number, out: number }>>({});

  const [relatedData, setRelatedData] = useState<{
    symbols: Node[];
    dependencies: Node[];
    dependants: Node[];
    annotations: any[];
  }>({ symbols: [], dependencies: [], dependants: [], annotations: [] });
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const relatedReqRef = useRef(0);

  useEffect(() => {
    if (!selectedNode || !db) {
      setRelatedData({ symbols: [], dependencies: [], dependants: [], annotations: [] });
      return;
    }

    const fetchRelated = async () => {
      const rid = ++relatedReqRef.current;
      setIsLoadingRelated(true);
      console.log(`%c[Related] START fetch for ${selectedNode.id} (RID: ${rid})`, 'color: #3b82f6; font-weight: bold');
      
      try {
        const start = performance.now();
        // Use optimized graph traversal syntax (-> and <-) for significantly faster queries
        const res = await db.query<any[][]>(`
          // 0. Full details for the selected node
          SELECT * FROM type::record($id);

          // 1. Symbols in this file (Optimized Traversal)
          SELECT id, name, path FROM symbol WHERE id IN (SELECT VALUE out FROM type::record($id)->contains);
          
          // 2. Outgoing dependencies (Optimized Traversal)
          SELECT id, name, path FROM (SELECT VALUE out FROM type::record($id)->(imports, depends_on));
          
          // 3. Incoming dependants (Optimized Traversal)
          SELECT id, name, path FROM (SELECT VALUE in FROM type::record($id)<-(imports, depends_on, contains));
        `, { id: selectedNode.id });

        const end = performance.now();
        
        console.log(`%c[Related] PRIMARY DATA DONE in ${(end - start).toFixed(1)}ms for ${selectedNode.id} (RID: ${rid})`, 'color: #10b981');

        if (rid !== relatedReqRef.current) {
          console.warn(`[Related] ABORT stale request ${rid}`);
          return;
        }

        // Update selected node with full details
        if (res[0]?.[0]) {
          const fullNode = res[0][0];
          setSelectedNode(prev => prev && prev.id === fullNode.id.toString() ? {
            ...prev,
            ...fullNode,
            id: fullNode.id.toString()
          } : prev);
        }

        const processNodes = (data: any[], type?: string) => (data || []).map(n => ({
          ...n,
          id: n.id.toString(),
          type: type || (n.id.toString().startsWith('file:') ? 'file' : n.id.toString().startsWith('module:') ? 'module' : 'symbol'),
          name: n.name || n.path?.split('/').pop() || n.id.toString(),
          path: n.path
        }));

        let annotations: any[] = [];
        try {
          // US.1: Inherited Knowledge - Resolve parent scopes
          const parentPaths: string[] = ['codebase'];
          if (selectedNode.path) {
            const parts = selectedNode.path.split('/');
            for (let i = 1; i <= parts.length; i++) {
              parentPaths.push(parts.slice(0, i).join('/'));
            }
          }

          const annRes = await db.query<any[][]>(`
            SELECT id, category, title, summary, priority, target_hash, author,
              (SELECT VALUE out FROM scoped_to)[0].path as scope_path
            FROM annotation 
            WHERE is_active = true 
              AND (
                count(->scoped_to->(file, module, repository, symbol)[WHERE id = type::record($id)]) > 0
                OR
                count(->scoped_to->(file, module, repository, symbol)[WHERE path IN $parents]) > 0
              )
            ORDER BY priority DESC;
          `, { id: selectedNode.id, parents: parentPaths });
          
          annotations = (annRes[0] || []).map(a => ({
            ...a,
            isInherited: a.scope_path !== selectedNode.path && a.scope_path !== 'codebase' && !selectedNode.id.includes(a.scope_path)
          }));
        } catch (e: any) {
          console.error('Annotation query failed:', e);
        }

        setRelatedData({
          symbols: processNodes(res[1], 'symbol'),
          dependencies: processNodes(res[2]),
          dependants: processNodes(res[3]),
          annotations: annotations
        });

        // Fetch Stats in a separate, non-blocking call to keep the UI snappy
        db.query<any[][]>(`
          SELECT count() as count, meta::tb(id) as type, 'out' as dir FROM (
            SELECT id FROM type::record($id)->(contains, imports, calls, depends_on)
          ) GROUP BY type;
          SELECT count() as count, meta::tb(id) as type, 'in' as dir FROM (
            SELECT id FROM type::record($id)<-(contains, imports, calls, depends_on)
          ) GROUP BY type;
        `, { id: selectedNode.id }).then(statsRes => {
          if (rid !== relatedReqRef.current) return;
          const stats: Record<string, { in: number, out: number }> = {};
          const processResults = (results: any[], dir: 'in' | 'out') => {
            (results || []).forEach((r: any) => {
              if (!stats[r.type]) stats[r.type] = { in: 0, out: 0 };
              stats[r.type][dir] = r.count;
            });
          };
          processResults(statsRes[0] || [], 'out');
          processResults(statsRes[1] || [], 'in');
          setEdgeStats(stats);
          console.log(`%c[Related] STATS UPDATED for ${selectedNode.id}`, 'color: #10b981');
        }).catch(err => console.error('[Related] Stats fetch failed:', err));

        console.log(`%c[Related] UI UPDATED for ${selectedNode.id}`, 'color: #6366f1');
      } catch (err) {
        console.error(`[Related] ERROR for ${selectedNode.id}:`, err);
      } finally {
        if (rid === relatedReqRef.current) {
          setIsLoadingRelated(false);
        }
      }
    };

    fetchRelated();
  }, [selectedNode?.id, db, refreshKey]);

  const handleNodeClick = (node: any) => {
    const nodeId = node.id || node;
    const existingNode = graphData.nodes.find(n => n.id === nodeId);
    const targetNode = existingNode || node;
    
    // US.7: Visual Traversal Planning
    if (isRecordingPath) {
      setRecordedPath(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
      return;
    }

    if (pathfindingMode.active) {
      if (!pathfindingMode.start) {
        setPathfindingMode(prev => ({ ...prev, start: nodeId }));
      } else if (!pathfindingMode.end && nodeId !== pathfindingMode.start) {
        const endId = nodeId;
        setPathfindingMode(prev => ({ ...prev, end: endId }));
        calculatePath(pathfindingMode.start, endId);
      } else {
        setPathfindingMode({ active: true, start: nodeId, end: null });
        setHighlightedPath(new Set());
      }
      return;
    }

    setSelectedNode(targetNode);
    
    if (fgRef.current) {
      fgRef.current.centerAt((targetNode as any).x ?? 0, (targetNode as any).y ?? 0, 1000);
      fgRef.current.zoom(2, 1000);
    }
  };

  const calculatePath = (startId: string, endId: string) => {
    const queue: [string, string[]][] = [[startId, [startId]]];
    const visited = new Set<string>([startId]);
    
    while (queue.length > 0) {
      const [currId, path] = queue.shift()!;
      if (currId === endId) {
        setHighlightedPath(new Set(path));
        return;
      }
      
      const neighbors = graphData.links
        .filter(l => (typeof l.source === 'object' ? (l.source as any).id : l.source) === currId)
        .map(l => (typeof l.target === 'object' ? (l.target as any).id : l.target));
        
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([next, [...path, next]]);
        }
      }
    }
    alert('No path found between these nodes.');
    setPathfindingMode({ active: true, start: null, end: null });
  };

  const runCycleDetection = () => {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles = new Set<string>();
    const adj: Record<string, string[]> = {};

    graphData.links.forEach(l => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (!adj[s]) adj[s] = [];
      adj[s].push(t);
    });

    const dfs = (u: string, path: string[]) => {
      visited.add(u);
      recStack.add(u);
      path.push(u);

      (adj[u] || []).forEach(v => {
        if (!visited.has(v)) {
          dfs(v, [...path]);
        } else if (recStack.has(v)) {
          // Cycle found
          const cycleIdx = path.indexOf(v);
          if (cycleIdx !== -1) {
            path.slice(cycleIdx).forEach(n => cycles.add(n));
          }
        }
      });

      recStack.delete(u);
    };

    graphData.nodes.forEach(n => {
      if (!visited.has(n.id)) dfs(n.id, []);
    });

    setCycleNodes(cycles);
    if (cycles.size > 0) {
      alert(`Detected ${cycles.size} nodes involved in circular dependencies.`);
    } else {
      alert('No circular dependencies detected in the current graph.');
    }
  };

  const addNodeToGraph = async (node: Node, linkToId?: string, linkType: string = 'contains') => {
    setGraphData(prev => {
      const exists = prev.nodes.find(n => n.id === node.id);
      const newNodes = exists ? prev.nodes : [...prev.nodes, { 
        ...node, 
        val: node.type === 'symbol' ? 3 : 8,
        color: node.type === 'symbol' ? '#a855f7' : node.type === 'file' ? '#6366f1' : '#10b981'
      }];
      
      const newLinks = [...prev.links];
      if (linkToId) {
        const linkExists = prev.links.find(l => 
          (typeof l.source === 'object' ? (l.source as any).id : l.source) === linkToId && 
          (typeof l.target === 'object' ? (l.target as any).id : l.target) === node.id
        );
        if (!linkExists) {
          newLinks.push({
            id: `dynamic:${linkToId}:${node.id}`,
            source: linkToId,
            target: node.id,
            type: linkType
          });
        }
      }
      
      return { nodes: newNodes, links: newLinks };
    });

    // If it's a symbol, we might want to also fetch its edges (calls, etc)
    if (node.type === 'symbol' && db) {
      const edgeRes = await db.query<any[][]>(
        'SELECT *, in as source, out as target FROM calls, references, implements WHERE in = type::record($id) OR out = type::record($id)',
        { id: node.id }
      );
      const edges = (edgeRes[0] || []).map((e: any) => ({
        id: e.id.toString(),
        source: e.source.toString(),
        target: e.target.toString(),
        type: e.id.toString().split(':')[0]
      }));
      
      setGraphData(prev => {
        const nodeIds = new Set(prev.nodes.map(n => n.id));
        const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        const existingEdgeIds = new Set(prev.links.map(l => l.id));
        
        return {
          ...prev,
          links: [...prev.links, ...filteredEdges.filter(e => !existingEdgeIds.has(e.id))]
        };
      });
    }
  };

  const expandFileSymbols = async (fileNode: Node) => {
    if (!db) return;
    try {
      // Get all symbols and their contains edges for this file
      const res = await db.query<any[][]>(
        `SELECT * FROM symbol WHERE id IN (SELECT VALUE out FROM contains WHERE in = type::record($id));
         SELECT *, in as source, out as target FROM contains WHERE in = type::record($id);`,
        { id: fileNode.id }
      );
      
      const symbols = (res[0] || []).map((n: any) => ({
        ...n,
        id: n.id.toString(),
        type: 'symbol',
        name: n.name,
        val: 3,
        color: '#a855f7'
      }));

      const newEdges = (res[1] || []).map((e: any) => ({
        id: e.id.toString(),
        source: e.source.toString(),
        target: e.target.toString(),
        type: 'contains'
      }));

      if (symbols.length === 0) {
        console.log("No symbols found for file:", fileNode.id);
      }

      setGraphData(prev => {
        const existingNodeIds = new Set(prev.nodes.map(n => n.id));
        const filteredSymbols = symbols.filter(s => !existingNodeIds.has(s.id));
        
        const existingEdgeIds = new Set(prev.links.map(l => l.id));
        const filteredEdges = newEdges.filter(e => !existingEdgeIds.has(e.id));

        return {
          nodes: [...prev.nodes, ...filteredSymbols],
          links: [...prev.links, ...filteredEdges]
        };
      });
    } catch (err) {
      console.error('Failed to expand file symbols:', err);
    }
  };

  const generateTraversalPlan = async (node: Node) => {
    if (!db) return;
    try {
      await db.query(`
        LET $readOrder = (
          SELECT path, (SELECT count() FROM <-imports WHERE out.type = 'file' AND in.id = $parent.id) as incoming_deps
          FROM (SELECT VALUE out FROM type::record($id)->contains WHERE out.type = 'file')
          ORDER BY incoming_deps ASC
        ).path;
        LET $ann = CREATE annotation CONTENT {
          category: 'traversal_hint',
          title: 'Auto-generated Traversal Plan',
          summary: 'Optimal read order from leaves to roots.',
          priority: 'normal',
          confidence: 0.9,
          read_order: $readOrder,
          is_active: true
        };
        LET $target = type::record($id);
        RELATE $ann->scoped_to->$target SET scope_type = 'module';
        RELATE $target->tagged_with->$ann;
      `, { id: node.id });
      alert('Traversal Plan generated and saved!');
      triggerRefresh();
    } catch (err: any) {
      console.error('Failed to generate traversal plan:', err);
      alert('Failed to generate traversal plan: ' + err.message);
    }
  };

  const handleSaveNote = async () => {
    if (!db || !selectedNode) return;
    try {
      if (noteForm.id) {
        // UPDATE existing note
        await db.query(`
          UPDATE type::record($id) SET
            category = $category,
            title = $title,
            summary = $summary,
            priority = $priority
        `, {
          id: noteForm.id,
          category: noteForm.category,
          title: noteForm.title,
          summary: noteForm.summary,
          priority: noteForm.priority
        });
      } else {
        // CREATE new note
        await db.query(`
          LET $ann = CREATE annotation CONTENT {
            category: $category,
            title: $title,
            summary: $summary,
            priority: $priority,
            confidence: 1.0,
            is_active: true,
            source: 'developer'
          };
          LET $target = type::record($nodeId);
          RELATE $ann->scoped_to->$target SET scope_type = $scope;
          RELATE $target->tagged_with->$ann;
        `, {
          category: noteForm.category,
          title: noteForm.title,
          summary: noteForm.summary,
          priority: noteForm.priority,
          nodeId: selectedNode.id,
          scope: selectedNode.type
        });
      }
      setIsNoteModalOpen(false);
      setNoteForm({ id: null, title: '', summary: '', category: 'guideline', priority: 'normal' });
      triggerRefresh();
    } catch (err: any) {
      console.error('Failed to save note:', err);
      alert('Failed to save note: ' + err.message);
    }
  };

  const handleDeleteNote = async (annId: string) => {
    if (!db || !selectedNode || !window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await db.query('DELETE type::record($id)', { id: annId });
      triggerRefresh();
    } catch (err: any) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note: ' + err.message);
    }
  };

  const expandNeighbors = async (node: Node) => {
    if (!db) return;
    try {
      const res = await db.query(
        'SELECT *, in as source, out as target, meta::tb(id) as type FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE in = type::record($id) OR out = type::record($id) LIMIT 200',
        { id: node.id }
      );
      
      const getResult = (r: any) => Array.isArray(r) ? r : [];
      const newEdges = getResult(res[0]).map((e: any) => ({
        id: e.id.toString(),
        source: e.source.toString(),
        target: e.target.toString(),
        type: e.type || e.id.toString().split(':')[0]
      }));

      const neighborIds = new Set<string>();
      newEdges.forEach(e => {
        neighborIds.add(e.source);
        neighborIds.add(e.target);
      });

      const neighborRes = await db.query(
        'SELECT * FROM symbol, file WHERE id IN $ids',
        { ids: Array.from(neighborIds) }
      );

      const newNodes = getResult(neighborRes[0]).map((n: any) => ({
        ...n,
        id: n.id.toString(),
        type: n.id.toString().startsWith('file:') ? 'file' : 'symbol',
        name: n.name || n.path?.split('/').pop() || n.id.toString().split(':')[1],
        val: n.id.toString().startsWith('file:') ? 8 : 3,
        color: n.id.toString().startsWith('file:') ? '#6366f1' : '#a855f7'
      }));

      setGraphData(prev => {
        const existingNodeIds = new Set(prev.nodes.map(n => n.id));
        const existingEdgeIds = new Set(prev.links.map(l => l.id));

        const filteredNewNodes = newNodes.filter(n => !existingNodeIds.has(n.id));
        const filteredNewEdges = newEdges.filter(e => !existingEdgeIds.has(e.id));

        return {
          nodes: [...prev.nodes, ...filteredNewNodes],
          links: [...prev.links, ...filteredNewEdges]
        };
      });
    } catch (err) {
      console.error('Expansion error:', err);
    }
  };

  const getLinkColor = (link: Edge) => {
    switch (link.type) {
      case 'calls': return '#f87171';
      case 'contains': return '#818cf8';
      case 'imports': return '#34d399';
      case 'exports': return '#fbbf24';
      case 'implements': return '#22d3ee';
      case 'references': return '#94a3b8';
      default: return 'rgba(255, 255, 255, 0.2)';
    }
  };

  return (
    <div className="graph-container">
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Connecting to Knowledge Graph...</p>
        </div>
      ) : (
        <>
          {appMode === 'graph' && (
            <div className="graph-container">
              <ForceGraph2D
            ref={fgRef}
            graphData={visibleData}
            nodeLabel={(node: any) => `${node.type}: ${node.name}`}
            nodeColor={(node: any) => {
              if (highlightedPath.has(node.id)) return '#facc15'; // Yellow for path
              if (cycleNodes.has(node.id)) return '#ef4444'; // Red for cycles
              if (isRecordingPath && recordedPath.includes(node.id)) return '#3b82f6';
              
              if (viewMode === 'tokens') {
                const weight = Math.min(1, (node.sizeBytes || 0) / 50000); // Scale by 50KB
                return `rgb(${Math.floor(weight * 255)}, ${Math.floor((1 - weight) * 200)}, 100)`;
              }
              if (viewMode === 'complexity') {
                const weight = Math.min(1, (node.outDegree || 0) / 10); // Scale by 10 deps
                return `rgb(${Math.floor(weight * 255)}, 100, ${Math.floor((1 - weight) * 255)})`;
              }

              if (pathfindingMode.active) {
                if (node.id === pathfindingMode.start) return '#10b981';
                if (node.id === pathfindingMode.end) return '#facc15';
                return 'rgba(255, 255, 255, 0.05)';
              }

              if (!selectedNode) return node.color;
              const isSelected = node.id === selectedNode.id;
              const isConnected = graphData.links.some(l => {
                const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
                const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
                return (sId === selectedNode.id && tId === node.id) || (tId === selectedNode.id && sId === node.id);
              });
              if (isSelected) return '#fff';
              if (isConnected) return node.color;
              return `${node.color}33`; // Dim others
            }}
            nodeRelSize={4}
            nodeVal={(node: any) => (selectedNode && node.id === selectedNode.id) ? 12 : (node.val || 4)}
            nodeCanvasObjectMode={node => (node.id === selectedNode?.id || (node as any).hasMemory) ? 'before' : undefined}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              if (selectedNode && node.id === selectedNode.id) {
                // Halo effect
                ctx.beginPath();
                ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fill();
                
                // Outer ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              }
              if (node.hasMemory) {
                // Gold dashed ring for Context Memory
                ctx.beginPath();
                const radius = (selectedNode && node.id === selectedNode.id) ? 10 : Math.sqrt(node.val || 4) + 3;
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#fbbf24'; // amber-400
                ctx.setLineDash([2, 2]);
                ctx.lineWidth = 1.5 / Math.max(1, globalScale);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }}
            linkDirectionalArrowLength={(link: any) => link.type === 'imports' ? 5 : 3}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.25}
            linkDirectionalParticles={(link: any) => {
              if (!selectedNode) return (link.type === 'calls' || link.type === 'imports') ? 2 : 0;
              const isRelevant = (link.source.id || link.source) === selectedNode.id || (link.target.id || link.target) === selectedNode.id;
              return isRelevant && (link.type === 'calls' || link.type === 'imports') ? 4 : 0;
            }}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={1.5}
            onNodeClick={handleNodeClick}
            backgroundColor="#0d0d12"
            linkColor={(link: any) => {
              const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
              const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
              
              if (highlightedPath.has(sId) && highlightedPath.has(tId)) return '#facc15';
              
              const base = getLinkColor(link);
              if (!selectedNode) return base;
              const isRelevant = sId === selectedNode.id || tId === selectedNode.id;
              return isRelevant ? base : '#ffffff08';
            }}
            linkWidth={(link: any) => {
              const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
              const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
              if (highlightedPath.has(sId) && highlightedPath.has(tId)) return 4;
              return (selectedNode && (sId === selectedNode.id || tId === selectedNode.id)) ? 2 : 1;
            }}
          />

          {error && (
            <div className="error-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1f2937', padding: '32px', borderRadius: '12px', textAlign: 'center', border: '1px solid #374151', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <Activity size={48} color="#ef4444" style={{ margin: '0 auto 20px', display: 'block' }} />
                <h2 style={{ color: '#f3f4f6', marginBottom: '12px', fontSize: '1.5rem', fontWeight: '600' }}>Index Not Found</h2>
                <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: '1.6' }}>{error}</p>
                <button className="action-btn" onClick={() => window.location.reload()} style={{ width: '100%', justifyContent: 'center', background: '#4f46e5', color: 'white', padding: '10px' }}>
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          <div className="overlay">
            <div className="panel sidebar glass-morphism">
              <div className="header">
                <div className="logo-section">
                  <Activity className="logo-icon" size={24} />
                  <div className="logo-text">TokenZip<span>Viz</span></div>
                </div>
                
                <div className="mode-switcher">
                  <button 
                    className={`mode-btn ${appMode === 'graph' ? 'active' : ''}`}
                    onClick={() => setAppMode('graph')}
                  >
                    <BarChart3 size={16} /> Map
                  </button>
                  <button 
                    className={`mode-btn ${(appMode as string) === 'playground' ? 'active' : ''}`}
                    onClick={() => setAppMode('playground')}
                  >
                    <Code2 size={16} /> Playground
                  </button>
                </div>

                <div className="status-badge">
                  <div className="status-dot"></div>
                  {dbPort}
                </div>
              </div>
              
              {repoInfo && (
                <div className="project-info">
                  <div className="project-name">{repoInfo.name}</div>
                  <div className="project-path">{repoInfo.path}</div>
                </div>
              )}

              <div className="legend-section">
                <h4>GRAPH LEGEND & FILTERS</h4>
                <div className="legend-group">
                  <h5>Nodes</h5>
                  <div 
                    className={`legend-item filterable ${filters.nodes.file ? 'active' : ''}`}
                    onClick={() => toggleFilter('nodes', 'file')}
                  >
                    <span className="node-dot file"></span> File
                  </div>
                  <div 
                    className={`legend-item filterable ${filters.nodes.symbol ? 'active' : ''}`}
                    onClick={() => toggleFilter('nodes', 'symbol')}
                  >
                    <span className="node-dot symbol"></span> Symbol
                  </div>
                  <div 
                    className={`legend-item filterable ${(filters.nodes as any).module ? 'active' : ''}`}
                    onClick={() => toggleFilter('nodes', 'module')}
                  >
                    <span className="node-dot module"></span> Folder/Module
                  </div>
                </div>
                <div className="legend-group">
                  <h5>Edges</h5>
                  {[
                    { id: 'calls', label: 'Calls', color: 'calls' },
                    { id: 'contains', label: 'Contains', color: 'contains' },
                    { id: 'imports', label: 'Imports', color: 'imports' },
                    { id: 'implements', label: 'Implements', color: 'implements' },
                    { id: 'depends_on', label: 'Depends On', color: 'depends_on' }
                  ].map(edge => (
                    <div 
                      key={edge.id}
                      className={`legend-item filterable ${(filters.edges as any)[edge.id] ? 'active' : ''}`}
                      onClick={() => toggleFilter('edges', edge.id)}
                    >
                      <span className={`edge-line ${edge.color}`}></span> {edge.label}
                    </div>
                  ))}
                </div>

                <div className="legend-group">
                  <h5>Visual Overlays</h5>
                  <div className="view-mode-selector">
                    <button className={viewMode === 'normal' ? 'active' : ''} onClick={() => setViewMode('normal')}>Default</button>
                    <button className={viewMode === 'tokens' ? 'active' : ''} onClick={() => setViewMode('tokens')}>Token Weight</button>
                    <button className={viewMode === 'complexity' ? 'active' : ''} onClick={() => setViewMode('complexity')}>Complexity</button>
                  </div>
                </div>
              </div>

              <div className="tools-section" style={{ marginTop: '24px' }}>
                <h4>ARCHITECTURAL TOOLS</h4>
                <div className="action-buttons" style={{ gridTemplateColumns: '1fr' }}>
                  <button 
                    className={`action-btn ${pathfindingMode.active ? 'primary' : 'secondary'}`}
                    onClick={() => {
                      setPathfindingMode(prev => ({ active: !prev.active, start: null, end: null }));
                      setHighlightedPath(new Set());
                    }}
                  >
                    <Search size={16} /> {pathfindingMode.active ? 'Exit Pathfinding' : 'Find Path (A → B)'}
                  </button>
                  <button className="action-btn secondary" onClick={runCycleDetection}>
                    <Activity size={16} /> Detect Circular Dependencies
                  </button>
                  <button 
                    className={`action-btn ${isRecordingPath ? 'primary' : 'secondary'}`}
                    onClick={() => {
                      if (isRecordingPath && recordedPath.length > 0) {
                        setNoteForm({ 
                          id: null, 
                          title: 'Traversal Narrative', 
                          summary: 'Suggested reading order: ' + recordedPath.map(id => id.split(':').pop()).join(' -> '), 
                          category: 'traversal_hint', 
                          priority: 'normal' 
                        });
                        setIsNoteModalOpen(true);
                      }
                      setIsRecordingPath(!isRecordingPath);
                      if (!isRecordingPath) setRecordedPath([]);
                    }}
                  >
                    <BookOpen size={16} /> {isRecordingPath ? 'Stop & Save Traversal' : 'Record Narrative Traversal'}
                  </button>
                </div>
                {isRecordingPath && (
                  <div className="recording-status" style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                    Recording Path: {recordedPath.length} steps. Click nodes to add.
                  </div>
                )}
                {pathfindingMode.active && (
                  <div className="pathfinding-hint" style={{ marginTop: '12px', fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(251,191,36,0.2)' }}>
                    {!pathfindingMode.start ? 'Select starting node...' : !pathfindingMode.end ? `From: ${pathfindingMode.start}. Select target node...` : 'Path highlighted. Click anywhere to reset.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedNode && (
            <div className={`details-panel glass-morphism ${isMaximized ? 'maximized' : ''}`}>
              <div className="details-header">
                <div className="node-title">
                  {selectedNode.type === 'file' ? <FileCode size={20} /> : <Zap size={20} />}
                  <div>
                    <h2>{selectedNode.name}</h2>
                    <span className="node-id">{selectedNode.id}</span>
                  </div>
                </div>
                <div className="header-actions">
                  <button className="icon-btn" onClick={() => setIsMaximized(!isMaximized)}>
                    <Maximize size={16} />
                  </button>
                  <button className="icon-btn close" onClick={() => { setSelectedNode(null); setIsMaximized(false); }}>
                    &times;
                  </button>
                </div>
              </div>

              <div className="details-scroll">
                {selectedNode.path && (
                  <div className="info-group">
                    <label>FILE PATH</label>
                    <div className="path-text">{selectedNode.path}</div>
                  </div>
                )}

                <div className="stats-row">
                  <div className="stat-card">
                    <label>Incoming Relationships</label>
                    <div className="stats-list">
                      {Object.entries(edgeStats).filter(([_, s]) => s.in > 0).map(([type, s]) => (
                        <div key={type} className="stat-line">
                          <span className={`type-dot ${type}`}></span>
                          <span className="type-name">{type}</span>
                          <span className="type-count">{s.in}</span>
                        </div>
                      ))}
                      {Object.values(edgeStats).every(s => s.in === 0) && <div className="no-stats">None</div>}
                    </div>
                  </div>
                  <div className="stat-card">
                    <label>Outgoing Relationships</label>
                    <div className="stats-list">
                      {Object.entries(edgeStats).filter(([_, s]) => s.out > 0).map(([type, s]) => (
                        <div key={type} className="stat-line">
                          <span className={`type-dot ${type}`}></span>
                          <span className="type-name">{type}</span>
                          <span className="type-count">{s.out}</span>
                        </div>
                      ))}
                      {Object.values(edgeStats).every(s => s.out === 0) && <div className="no-stats">None</div>}
                    </div>
                  </div>
                </div>

                {(() => {
                  const visibleLinksCount = graphData.links.filter(l => 
                    (typeof l.source === 'object' ? (l.source as any).id : l.source) === selectedNode.id || 
                    (typeof l.target === 'object' ? (l.target as any).id : l.target) === selectedNode.id
                  ).length;
                  const totalLinksCount = Object.values(edgeStats).reduce((acc, s) => acc + s.in + s.out, 0);
                  
                  if (totalLinksCount > visibleLinksCount) {
                    return (
                      <div className="connectivity-warning">
                        <Info size={16} />
                        <span>{totalLinksCount - visibleLinksCount} connections are currently hidden.</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="actions-group">
                  <label>EXPLORATION ACTIONS</label>
                  <div className="action-buttons">
                  {selectedNode.type === 'file' && (
                    <button className="action-btn primary" onClick={() => expandFileSymbols(selectedNode)}>
                      <Zap size={16} /> Show Internal Symbols
                    </button>
                  )}
                  {selectedNode.type === 'module' && (
                    <button className="action-btn primary" onClick={() => generateTraversalPlan(selectedNode)}>
                      <BookOpen size={16} /> Gen. Traversal Plan
                    </button>
                  )}
                  <button className="action-btn secondary" onClick={() => {
                    setNoteForm({ id: null, title: '', summary: '', category: 'guideline', priority: 'normal' });
                    setIsNoteModalOpen(true);
                  }}>
                    <Plus size={16} /> Tag Context Memory
                  </button>
                  <button className="action-btn secondary" onClick={() => expandNeighbors(selectedNode)}>
                    <Maximize2 size={16} /> Expand Neighborhood
                  </button>
                    <button className="action-btn secondary" onClick={() => {
                      const relatedEdges = graphData.links.filter(l => 
                        (typeof l.source === 'object' ? (l.source as any).id : l.source) === selectedNode.id || 
                        (typeof l.target === 'object' ? (l.target as any).id : l.target) === selectedNode.id
                      );
                      const relatedNodeIds = new Set([
                        selectedNode.id, 
                        ...relatedEdges.map(l => typeof l.source === 'object' ? (l.source as any).id : l.source), 
                        ...relatedEdges.map(l => typeof l.target === 'object' ? (l.target as any).id : l.target)
                      ]);
                      setGraphData(prev => ({
                        nodes: prev.nodes.filter(n => relatedNodeIds.has(n.id)),
                        links: relatedEdges
                      }));
                    }}>
                      <Maximize size={16} /> Isolate Context
                    </button>
                  </div>
                </div>

                <div className={`related-sections ${isLoadingRelated ? 'loading' : ''}`}>
                  {relatedData.annotations.length > 0 && (
                    <div className="related-group cortex-memory">
                      <div className="group-header">
                        <label>CONTEXT MEMORY ({relatedData.annotations.length})</label>
                      </div>
                      <div className="item-list">
                          {relatedData.annotations.map(ann => (
                          <div key={ann.id.toString()} className={`item-row memory-note ${ann.isInherited ? 'inherited' : ''}`} style={{ position: 'relative' }}>
                            <div className="row-info" style={{ flex: 1 }}>
                              <div className="row-name" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className={`priority-badge ${ann.priority}`} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)' }}>{ann.priority}</span>
                                <span className={`author-badge ${ann.author || 'human'}`}>{ann.author || 'human'}</span>
                                <span className="category-badge" style={{ fontSize: '0.65rem', color: '#a855f7' }}>{ann.category}</span>
                                {ann.isInherited && <span className="inherited-badge" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>inherited from {ann.scope_path}</span>}
                                <strong style={{ color: '#fff', width: '100%' }}>{ann.title}</strong>
                              </div>
                              <div className="row-path" style={{ marginTop: '4px', color: '#9ca3af' }}>{ann.summary}</div>
                            </div>
                            <div className="row-actions" style={{ display: 'flex', gap: '8px', opacity: 0.6 }}>
                              <button className="icon-btn tiny" onClick={() => {
                                setNoteForm({
                                  id: ann.id.toString(),
                                  title: ann.title,
                                  summary: ann.summary,
                                  category: ann.category,
                                  priority: ann.priority
                                });
                                setIsNoteModalOpen(true);
                              }}>
                                <Edit2 size={12} />
                              </button>
                              <button className="icon-btn tiny delete" onClick={() => handleDeleteNote(ann.id.toString())}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="related-group">
                    <div className="group-header">
                      <label>SYMBOLS ({relatedData.symbols.length})</label>
                      <span title="Click to add symbol to graph"><Info size={12} /></span>
                    </div>
                    <div className="item-grid">
                      {relatedData.symbols.map(s => (
                        <div key={s.id} className="item-tag symbol" onClick={() => addNodeToGraph(s, selectedNode.id)}>
                          <Zap size={10} /> {s.name}
                        </div>
                      ))}
                      {!isLoadingRelated && relatedData.symbols.length === 0 && <div className="empty-hint">No symbols indexed</div>}
                    </div>
                  </div>

                  <div className="related-group">
                    <label>DEPENDS ON ({relatedData.dependencies.length})</label>
                    <div className="item-list">
                      {relatedData.dependencies.map(d => (
                        <div key={d.id} className="item-row" onClick={() => handleNodeClick(d)}>
                          <div className={`row-icon ${d.type}`}>
                            {d.type === 'file' ? <FileCode size={12} /> : <Activity size={12} />}
                          </div>
                          <div className="row-info">
                            <div className="row-name">{d.name}</div>
                            <div className="row-path">{d.path}</div>
                          </div>
                          <ChevronRight size={12} />
                        </div>
                      ))}
                      {!isLoadingRelated && relatedData.dependencies.length === 0 && <div className="empty-hint">No outgoing dependencies</div>}
                    </div>
                  </div>

                  <div className="related-group">
                    <label>USED BY ({relatedData.dependants.length})</label>
                    <div className="item-list">
                      {relatedData.dependants.map(d => (
                        <div key={d.id} className="item-row" onClick={() => handleNodeClick(d)}>
                          <div className={`row-icon ${d.type}`}>
                            {d.type === 'file' ? <FileCode size={12} /> : <Activity size={12} />}
                          </div>
                          <div className="row-info">
                            <div className="row-name">{d.name}</div>
                            <div className="row-path">{d.path}</div>
                          </div>
                          <ChevronRight size={12} />
                        </div>
                      ))}
                      {!isLoadingRelated && relatedData.dependants.length === 0 && <div className="empty-hint">No incoming dependants</div>}
                    </div>
                  </div>
                </div>

                {selectedNode.signature && (
                  <div className="info-group">
                    <label>CODE SIGNATURE</label>
                    <div className="code-container">
                      <pre><code>{selectedNode.signature}</code></pre>
                    </div>
                  </div>
                )}

                {selectedNode.docs && (
                  <div className="info-group">
                    <label>DOCUMENTATION</label>
                    <div className="docs-text">{selectedNode.docs}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="viewport-controls">
            <button title="Fit View" onClick={() => fgRef.current.zoomToFit(400)}><Maximize size={18}/></button>
            <button title="Zoom In" onClick={() => fgRef.current.zoom(fgRef.current.zoom() * 1.5)}><ZoomIn size={18}/></button>
            <button title="Zoom Out" onClick={() => fgRef.current.zoom(fgRef.current.zoom() * 0.7)}><ZoomOut size={18}/></button>
          </div>

          <div className="global-search-container">
            <div className={`search-bar-wrapper glass-morphism ${searchResults.length > 0 ? 'has-results' : ''}`}>
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search symbols, files, relationships..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {isSearching ? <div className="search-spinner"></div> : <div className="search-hint">⌘K</div>}
              
              {searchTerm && !isSearching && (
                <button className="clear-search" onClick={() => { setSearchTerm(''); setSearchResults([]); }}>&times;</button>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="search-results-dropdown glass-morphism">
                <div className="results-header">
                  <div className="results-count">{searchResults.length} RESULTS FOUND</div>
                  <div className="search-filters">
                    <button 
                      className={`filter-pill ${searchTypeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setSearchTypeFilter('all')}
                    >All</button>
                    <button 
                      className={`filter-pill ${searchTypeFilter === 'file' ? 'active' : ''}`}
                      onClick={() => setSearchTypeFilter('file')}
                    >Files</button>
                    <button 
                      className={`filter-pill ${searchTypeFilter === 'symbol' ? 'active' : ''}`}
                      onClick={() => setSearchTypeFilter('symbol')}
                    >Symbols</button>
                  </div>
                </div>
                <div className="results-list">
                  {searchResults.map(result => (
                    <div 
                      key={result.id} 
                      className="search-result-row"
                      onClick={() => handleSelectSearchResult(result)}
                    >
                      <div className={`result-type-icon ${result.type}`}>
                        {result.type === 'file' ? <FileCode size={16} /> : <Zap size={16} />}
                      </div>
                      <div className="result-content">
                        <div className="result-primary">{result.name}</div>
                        <div className="result-secondary">{result.path || result.id}</div>
                      </div>
                      <ChevronRight className="arrow-icon" size={14} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isNoteModalOpen && selectedNode && appMode === 'graph' && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="modal-content" style={{ background: '#1f2937', padding: '32px', borderRadius: '12px', border: '1px solid #374151', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h2 style={{ color: '#f3f4f6', margin: 0, fontSize: '1.5rem' }}>{noteForm.id ? 'Edit Context Memory' : 'Add Context Memory'}</h2>
            <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.875rem' }}>Target: <strong style={{color: '#fff'}}>{selectedNode.name}</strong></p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <label style={{ color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500 }}>Title</label>
              <input type="text" value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} style={{ background: '#111827', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px' }} placeholder="E.g., Authentication Gotcha" />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500 }}>Category</label>
                <select value={noteForm.category} onChange={e => setNoteForm(f => ({ ...f, category: e.target.value }))} style={{ background: '#111827', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px' }}>
                  <option value="guideline">Guideline</option>
                  <option value="gotcha">Gotcha</option>
                  <option value="architecture">Architecture</option>
                  <option value="todo">TODO</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500 }}>Priority</label>
                <select value={noteForm.priority} onChange={e => setNoteForm(f => ({ ...f, priority: e.target.value }))} style={{ background: '#111827', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px' }}>
                  <option value="critical">Critical</option>
                  <option value="important">Important</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#d1d5db', fontSize: '0.875rem', fontWeight: 500 }}>Summary</label>
              <textarea value={noteForm.summary} onChange={e => setNoteForm(f => ({ ...f, summary: e.target.value }))} style={{ background: '#111827', border: '1px solid #374151', color: '#fff', padding: '10px', borderRadius: '6px', minHeight: '80px', resize: 'vertical' }} placeholder="Briefly describe the context..." />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="action-btn secondary" onClick={() => setIsNoteModalOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button className="action-btn primary" onClick={handleSaveNote} style={{ flex: 1, justifyContent: 'center' }} disabled={!noteForm.title || !noteForm.summary}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {appMode === 'playground' && (
        <Playground 
          db={db}
          repoInfo={repoInfo}
          initialFile={selectedPlaygroundFile}
          onFileChange={setSelectedPlaygroundFile}
          appMode={appMode}
          setAppMode={setAppMode}
        />
      )}
    </>
    )}
    </div>
  );
};

export default App;
