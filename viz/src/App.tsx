import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Surreal } from 'surrealdb';
import { 
  Search, 
  Settings, 
  Maximize2, 
  Zap, 
  Activity, 
  FileCode, 
  ChevronRight, 
  Maximize, 
  MousePointer2,
  Info,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import './App.css';

interface Node {
  id: string;
  type: string;
  name: string;
  path?: string;
  signature?: string;
  docs?: string;
  val: number;
  color?: string;
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
  const [repoInfo, setRepoInfo] = useState<{ name: string; path: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchTypeFilter, setSearchTypeFilter] = useState<'all' | 'file' | 'symbol'>('all');
  const [filters, setFilters] = useState({
    nodes: { file: true, symbol: true },
    edges: { calls: true, contains: true, imports: true, implements: true, exports: true, references: true }
  });
  const fgRef = useRef<any>();

  const urlParams = new URLSearchParams(window.location.search);
  const dbPort = urlParams.get('port') || '8000';

  useEffect(() => {
    const initDb = async () => {
      const surreal = new Surreal();
      try {
        await surreal.connect(`http://127.0.0.1:${dbPort}`);
        await surreal.signin({ username: 'root', password: 'root' });
        await surreal.use({ ns: 'tokenzip', db: 'graph' });
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

  const fetchData = async (surreal: Surreal) => {
    try {
      // Progressive Loading: Load files and their relationships first
      const fileRes = await surreal.query<any[][]>('SELECT * FROM file LIMIT 3000');
      
      const nodes: Node[] = (fileRes[0] || []).map((n: any) => {
        const idStr = n.id.toString();
        return {
          id: idStr,
          type: 'file',
          name: n.path.split('/').pop() || n.path || idStr,
          path: n.path,
          val: 10,
          color: '#6366f1'
        };
      });

      const nodeIds = new Set(nodes.map(n => n.id));

      // Initially only load architectural edges (imports, exports, depends_on)
      const edgeRes = await surreal.query<any[][]>('SELECT *, in as source, out as target FROM imports, exports, depends_on LIMIT 20000');
      const links: Edge[] = (edgeRes[0] || [])
        .map((e: any) => ({
          id: e.id.toString(),
          source: e.source.toString(),
          target: e.target.toString(),
          type: e.type || e.id.toString().split(':')[0]
        }))
        .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

      const repoRes = await surreal.query<any[][]>('SELECT name, path FROM repository LIMIT 1');
      if (repoRes[0]?.[0]) {
        setRepoInfo(repoRes[0][0]);
      }

      setGraphData({ nodes, links });
      setLoading(false);
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setLoading(false);
    }
  };

  const [searchResults, setSearchResults] = useState<Node[]>([]);
  const searchTimeout = useRef<any>();

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
          queryStr = 'SELECT * FROM symbol WHERE string::lowercase(name) CONTAINS $q LIMIT 15; SELECT * FROM file WHERE string::lowercase(path) CONTAINS $q LIMIT 15;';
        } else if (searchTypeFilter === 'file') {
          queryStr = 'SELECT * FROM file WHERE string::lowercase(path) CONTAINS $q LIMIT 25;';
        } else {
          queryStr = 'SELECT * FROM symbol WHERE string::lowercase(name) CONTAINS $q LIMIT 25;';
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

  const [edgeCounts, setEdgeCounts] = useState<{ in: number, out: number }>({ in: 0, out: 0 });

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

  useEffect(() => {
    if (!selectedNode || !db) return;
    
    const fetchStats = async () => {
      try {
        const res = await db.query(
          `SELECT count() as count, meta::tb(id) as type, 'out' as dir FROM (
            SELECT id FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE in = type::record($id)
          ) GROUP BY type;
          SELECT count() as count, meta::tb(id) as type, 'in' as dir FROM (
            SELECT id FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE out = type::record($id)
          ) GROUP BY type;`,
          { id: selectedNode.id }
        );
        
        const stats: Record<string, { in: number, out: number }> = {};
        
        const processResults = (results: any[], dir: 'in' | 'out') => {
          (results || []).forEach((r: any) => {
            if (!stats[r.type]) stats[r.type] = { in: 0, out: 0 };
            stats[r.type][dir] = r.count;
          });
        };

        processResults((res as any)?.[0] || [], 'out');
        processResults((res as any)?.[1] || [], 'in');
        
        setEdgeStats(stats);
      } catch (err) {
        console.error('Failed to fetch edge stats:', err);
      }
    };
    
    fetchStats();
  }, [selectedNode, db]);

  const handleNodeClick = (node: any) => {
    // If node is not in current graph, we might need to fetch its neighborhood
    // For now, just select it if it's in the graph
    const existingNode = graphData.nodes.find(n => n.id === node.id);
    if (existingNode) {
      setSelectedNode(existingNode);
      if (fgRef.current) {
        fgRef.current.centerAt((existingNode as any).x ?? 0, (existingNode as any).y ?? 0, 1000);
        fgRef.current.zoom(2, 1000);
      }
    } else {
      setSelectedNode(node);
      // Optional: Add logic to fetch and add node to graph
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
        <div className="graph-container">
          <ForceGraph2D
            ref={fgRef}
            graphData={visibleData}
            nodeLabel={(node: any) => `${node.type}: ${node.name}`}
            nodeColor={(node: any) => node.color}
            nodeRelSize={4}
            linkDirectionalArrowLength={(link: any) => link.type === 'imports' ? 5 : 3}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.25}
            linkDirectionalParticles={(link: any) => (link.type === 'calls' || link.type === 'imports') ? 2 : 0}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={1.5}
            onNodeClick={handleNodeClick}
            backgroundColor="#0d0d12"
            linkColor={getLinkColor}
            linkWidth={(link: any) => (selectedNode && (link.source.id === selectedNode.id || link.target.id === selectedNode.id)) ? 2 : 1}
          />
          <div className="overlay">
            <div className="panel sidebar glass-morphism">
              <div className="header">
                <div className="logo-section">
                  <Activity className="logo-icon" size={24} />
                  <div className="logo-text">TokenZip<span>Viz</span></div>
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
                </div>
                <div className="legend-group">
                  <h5>Edges</h5>
                  {[
                    { id: 'calls', label: 'Calls', color: 'calls' },
                    { id: 'contains', label: 'Contains', color: 'contains' },
                    { id: 'imports', label: 'Imports', color: 'imports' },
                    { id: 'implements', label: 'Implements', color: 'implements' }
                  ].map(edge => (
                    <div 
                      key={edge.id}
                      className={`legend-item filterable ${filters.edges[edge.id as keyof typeof filters.edges] ? 'active' : ''}`}
                      onClick={() => toggleFilter('edges', edge.id)}
                    >
                      <span className={`edge-line ${edge.color}`}></span> {edge.label}
                    </div>
                  ))}
                </div>
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
                  <button className="action-btn secondary" onClick={() => expandNeighbors(selectedNode)}>
                    <Maximize2 size={16} /> Expand Neighborhood
                  </button>
                    <button className="action-btn secondary" onClick={() => {
                      const relatedEdges = graphData.links.filter(l => 
                        (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode.id || 
                        (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode.id
                      );
                      const relatedNodeIds = new Set([
                        selectedNode.id, 
                        ...relatedEdges.map(l => typeof l.source === 'object' ? l.source.id : l.source), 
                        ...relatedEdges.map(l => typeof l.target === 'object' ? l.target.id : l.target)
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
    </div>
  );
};

export default App;
