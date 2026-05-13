import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Surreal } from 'surrealdb';
import { Search, Info, ZoomIn, ZoomOut, Maximize, MousePointer2 } from 'lucide-react';
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
  const fgRef = useRef<any>();

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
      const nodeRes = await surreal.query<any[][]>('SELECT * FROM symbol, file LIMIT 5000');
      const nodes: Node[] = (nodeRes[0] || []).map((n: any) => ({
        id: n.id.toString(),
        type: n.type || (n.id.toString().startsWith('file:') ? 'file' : 'symbol'),
        name: n.name || n.id.toString().split(':')[1] || n.id.toString(),
        path: n.path,
        signature: n.signature,
        docs: n.doc,
        val: n.id.toString().startsWith('file:') ? 8 : 3,
        color: n.id.toString().startsWith('file:') ? '#6366f1' : '#a855f7'
      }));

      const nodeIds = new Set(nodes.map(n => n.id));

      const edgeRes = await surreal.query<any[][]>('SELECT *, in as target, out as source FROM contains, imports, exports, calls, implements, inherits, modifies, reads, references, depends_on LIMIT 10000');
      const links: Edge[] = (edgeRes[0] || [])
        .map((e: any) => ({
          id: e.id.toString(),
          source: e.source.toString(),
          target: e.target.toString(),
          type: e.type || e.id.toString().split(':')[0]
        }))
        .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

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
      try {
        const res = await db.query<any[][]>(
          'SELECT *, meta::table(id) as type FROM symbol, file WHERE name CONTAINS $q OR path CONTAINS $q LIMIT 10',
          { q: searchTerm.toLowerCase() }
        );
        const nodes = (res[0] || []).map((n: any) => ({
          id: n.id.toString(),
          type: n.type || (n.id.toString().startsWith('file:') ? 'file' : 'symbol'),
          name: n.name || n.id.toString().split(':')[1] || n.id.toString(),
          path: n.path,
          signature: n.signature,
          docs: n.doc,
          val: n.id.toString().startsWith('file:') ? 8 : 3,
          color: n.id.toString().startsWith('file:') ? '#6366f1' : '#a855f7'
        }));
        setSearchResults(nodes);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm, db]);

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

  const getLinkColor = (link: Edge) => {
    switch (link.type) {
      case 'calls': return '#f87171'; // Red
      case 'contains': return '#818cf8'; // Indigo
      case 'imports': return '#34d399'; // Emerald
      case 'exports': return '#fbbf24'; // Amber
      case 'implements': return '#22d3ee'; // Cyan
      case 'references': return '#94a3b8'; // Slate
      default: return 'rgba(255, 255, 255, 0.1)';
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
            backgroundColor="#0a0a0c"
            linkColor={getLinkColor}
            linkWidth={(link: any) => link === selectedNode ? 2 : 1}
          />

          <div className="overlay">
            <div className="panel">
              <div className="header">
                <div className="logo">TokenZip Viz</div>
                <div className="status-indicator">
                  <div className="dot"></div>
                  Connected: {dbPort}
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Search symbols or files..." 
                className="search-box"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <div className="search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map(n => (
                      <div key={n.id} className="search-item" onClick={() => handleNodeClick(n)}>
                        <span className={`mini-dot type-${n.type}`}></span>
                        <div className="search-item-info">
                          <div className="search-item-name">{n.name}</div>
                          {n.path && <div className="search-item-path">{n.path}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="search-no-results">No matches found in DB</div>
                  )}
                </div>
              )}

              <div className="legend">
                <h4>Legend</h4>
                <div className="legend-item"><span className="dot file"></span> File</div>
                <div className="legend-item"><span className="dot symbol"></span> Symbol</div>
                <div className="legend-divider"></div>
                <div className="legend-item"><span className="line calls"></span> Calls</div>
                <div className="legend-item"><span className="line contains"></span> Contains</div>
                <div className="legend-item"><span className="line imports"></span> Imports</div>
              </div>
            </div>
          </div>

          {selectedNode && (
            <div className="details-panel panel">
              <div className="node-info">
                <span className={`node-type type-${selectedNode.type}`}>
                  {selectedNode.type}
                </span>
                <h2>{selectedNode.name}</h2>
                {selectedNode.path && <p className="node-path">{selectedNode.path}</p>}
              </div>
              
              {selectedNode.signature && (
                <>
                  <h3>Signature</h3>
                  <div className="code-block">{selectedNode.signature}</div>
                </>
              )}

              {selectedNode.docs && (
                <>
                  <h3>Documentation</h3>
                  <p className="docs-text">{selectedNode.docs}</p>
                </>
              )}

              <button className="btn" style={{marginTop: 'auto'}} onClick={() => setSelectedNode(null)}>
                Close
              </button>
            </div>
          )}

          <div className="controls">
            <button className="btn" onClick={() => fgRef.current.zoomToFit(400)}><Maximize size={16}/> Fit View</button>
            <button className="btn" onClick={() => fgRef.current.zoom(fgRef.current.zoom() * 1.2)}><ZoomIn size={16}/> Zoom In</button>
            <button className="btn" onClick={() => fgRef.current.zoom(fgRef.current.zoom() * 0.8)}><ZoomOut size={16}/> Zoom Out</button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
