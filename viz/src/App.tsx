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
      // Increase limits to handle medium-sized codebases better
      // Fetch files and symbols separately to ensure we get both in large repos
      const fileRes = await surreal.query<any[][]>('SELECT * FROM file LIMIT 2000');
      const symbolRes = await surreal.query<any[][]>('SELECT * FROM symbol LIMIT 8000');
      
      const rawNodes = [...(fileRes[0] || []), ...(symbolRes[0] || [])];
      
      const nodes: Node[] = rawNodes.map((n: any) => {
        const idStr = n.id.toString();
        const isFile = idStr.startsWith('file:');
        return {
          id: idStr,
          type: n.type || (isFile ? 'file' : 'symbol'),
          name: n.name || idStr.split(':')[1] || idStr,
          path: n.path,
          signature: n.signature,
          docs: n.doc,
          val: isFile ? 8 : 3,
          color: isFile ? '#6366f1' : '#a855f7'
        };
      });

      const nodeIds = new Set(nodes.map(n => n.id));

      const edgeRes = await surreal.query<any[][]>('SELECT *, in as source, out as target FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on LIMIT 30000');
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
        const res = await db.query(
          'SELECT * FROM symbol WHERE string::lowercase(name) CONTAINS $q LIMIT 10; SELECT * FROM file WHERE string::lowercase(path) CONTAINS $q LIMIT 10;',
          { q: query }
        );
        
        const getResult = (r: any) => Array.isArray(r) ? r : (r?.result || []);

        const symbols = getResult(res[0]).map((n: any) => ({
          ...n,
          id: n.id.toString(),
          type: 'symbol',
          name: n.name,
          val: 3,
          color: '#a855f7'
        }));

        const files = getResult(res[1]).map((n: any) => ({
          ...n,
          id: n.id.toString(),
          type: 'file',
          name: n.path.split('/').pop() || n.path,
          val: 8,
          color: '#6366f1'
        }));

        setSearchResults([...symbols, ...files].slice(0, 10));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm, db]);

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

  useEffect(() => {
    if (!selectedNode || !db) return;
    
    const fetchCounts = async () => {
      try {
        const res = await db.query(
          `SELECT count() as count FROM (
            SELECT id FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE in = type::record($id)
          ) GROUP ALL;
          SELECT count() as count FROM (
            SELECT id FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE out = type::record($id)
          ) GROUP ALL;`,
          { id: selectedNode.id }
        );
        const outCount = (res as any)?.[0]?.[0]?.count || 0;
        const inCount = (res as any)?.[1]?.[0]?.count || 0;
        setEdgeCounts({ in: inCount, out: outCount });
      } catch (err) {
        console.error('Failed to fetch edge counts:', err);
      }
    };
    
    fetchCounts();
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

  const expandNeighbors = async (node: Node) => {
    if (!db) return;
    try {
      const res = await db.query(
        'SELECT *, in as source, out as target, meta::table(id) as type FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on WHERE in = type::record($id) OR out = type::record($id) LIMIT 200',
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
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeLabel={(node: any) => `${node.type}: ${node.name}`}
            nodeColor={(node: any) => node.color}
            nodeRelSize={4}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.25}
            onNodeClick={handleNodeClick}
            backgroundColor="#0d0d12"
            linkColor={getLinkColor}
            linkWidth={(link: any) => (selectedNode && (link.source.id === selectedNode.id || link.target.id === selectedNode.id)) ? 2 : 1}
          />

          <div className="overlay">
            <div className="panel sidebar">
              <div className="header">
                <div className="logo-section">
                  <Activity className="logo-icon" size={24} />
                  <div className="logo-text">TokenZip<span>Viz</span></div>
                </div>
                {repoInfo && (
                  <div className="project-info">
                    <div className="project-name">{repoInfo.name}</div>
                    <div className="project-path">{repoInfo.path}</div>
                  </div>
                )}
                <div className="status-badge">
                  <div className="status-dot"></div>
                  {dbPort}
                </div>
              </div>
              
              <div className="search-container">
                <div className="search-input-wrapper">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search repository (symbols, files)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {isSearching && <div className="search-spinner"></div>}
                </div>
                
                {searchResults.length > 0 && (
                  <div className="search-results glass-panel">
                    {searchResults.map(result => (
                      <div 
                        key={result.id} 
                        className="search-result-item"
                        onClick={() => handleSelectSearchResult(result)}
                      >
                        <div className={`result-icon ${result.type}`}>
                          {result.type === 'file' ? <FileCode size={14} /> : <Zap size={14} />}
                        </div>
                        <div className="result-info">
                          <div className="result-name">{result.name}</div>
                          {result.path && <div className="result-path">{result.path}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="legend-section">
                <h4>GRAPH LEGEND</h4>
                <div className="legend-group">
                  <h5>Nodes</h5>
                  <div className="legend-item"><span className="node-dot file"></span> File</div>
                  <div className="legend-item"><span className="node-dot symbol"></span> Symbol</div>
                </div>
                <div className="legend-group">
                  <h5>Edges</h5>
                  <div className="legend-item"><span className="edge-line calls"></span> Calls</div>
                  <div className="legend-item"><span className="edge-line contains"></span> Contains</div>
                  <div className="legend-item"><span className="edge-line imports"></span> Imports</div>
                  <div className="legend-item"><span className="edge-line implements"></span> Implements</div>
                </div>
              </div>
            </div>
          </div>

          {selectedNode && (
            <div className="details-panel glass-morphism">
              <div className="details-header">
                <div className="node-title">
                  {selectedNode.type === 'file' ? <FileCode size={20} /> : <Zap size={20} />}
                  <div>
                    <h2>{selectedNode.name}</h2>
                    <span className="node-id">{selectedNode.id}</span>
                  </div>
                </div>
                <button className="close-panel" onClick={() => setSelectedNode(null)}>&times;</button>
              </div>

              <div className="details-scroll">
                {selectedNode.path && (
                  <div className="info-group">
                    <label>FILE PATH</label>
                    <div className="path-text">{selectedNode.path}</div>
                  </div>
                )}

                <div className="stats-row">
                  <div className="stat-item">
                    <label>INCOMING</label>
                    <div className="stat-value">{edgeCounts.in}</div>
                  </div>
                  <div className="stat-item">
                    <label>OUTGOING</label>
                    <div className="stat-value">{edgeCounts.out}</div>
                  </div>
                </div>

                <div className="actions-group">
                  <label>EXPLORATION ACTIONS</label>
                  <div className="action-buttons">
                    <button className="action-btn primary" onClick={() => expandNeighbors(selectedNode)}>
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
        </>
      )}
    </div>
  );
};

export default App;
