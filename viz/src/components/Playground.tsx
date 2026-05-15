import React, { useState, useEffect } from 'react';
import { Activity, Code2, BarChart3, FileCode, Zap, Cpu, Settings, Layers, Sliders } from 'lucide-react';
import { Surreal } from 'surrealdb';

interface PlaygroundProps {
  db: Surreal | null;
  repoInfo: { name: string; path: string } | null;
  initialFile?: string | null;
  onFileChange: (path: string) => void;
  appMode: 'graph' | 'playground';
  setAppMode: (mode: 'graph' | 'playground') => void;
}

const Playground: React.FC<PlaygroundProps> = ({ db, repoInfo, initialFile, onFileChange, appMode, setAppMode }) => {
  const [playgroundFiles, setPlaygroundFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(initialFile || null);
  const [comparisonData, setComparisonData] = useState<{ 
    raw: string, 
    smart: string, 
    savings: number,
    rawTokens: number,
    smartTokens: number
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tool Parameters
  const [smartMode, setSmartMode] = useState<'auto' | 'skeleton' | 'normal' | 'interface_only' | 'dependency_only' | 'implementation_of'>('auto');
  const [tokenBudget, setTokenBudget] = useState(500);
  const [includeDocs, setIncludeDocs] = useState(false);
  const [targetSymbol, setTargetSymbol] = useState('');
  const [fileSymbols, setFileSymbols] = useState<string[]>([]);

  useEffect(() => {
    fetchFiles();
  }, [db]);

  useEffect(() => {
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [smartMode, tokenBudget, includeDocs, targetSymbol]);

  useEffect(() => {
    if (initialFile && initialFile !== selectedFile) {
      handleFileSelect(initialFile);
    }
  }, [initialFile]);

  const fetchFiles = async () => {
    if (!db) return;
    try {
      const res = await db.query<any[]>('SELECT id, path FROM file LIMIT 50');
      const files = res[0] || [];
      setPlaygroundFiles(files);
      if (files.length > 0 && !selectedFile && !initialFile) {
        handleFileSelect(files[0].path);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    onFileChange(path);
    setIsComparing(true);
    setComparisonData(null);
    setError(null);
    try {
      const response = await fetch(`http://localhost:6001/api/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: repoInfo?.name || 'openclaw',
          toolName: 'smart_file_read',
          args: { 
            path,
            mode: smartMode === 'normal' ? 'auto' : smartMode, // 'normal' doesn't exist in backend, it's just auto with high budget
            budget: tokenBudget,
            include_docs: includeDocs,
            target_symbol: targetSymbol
          }
        })
      });
      
      if (!response.ok) throw new Error('Backend error');
      
      const smartResult = await response.json();
      
      const rawResponse = await fetch(`http://localhost:6001/api/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: repoInfo?.name || 'openclaw',
          toolName: 'file_read',
          args: { path }
        })
      });
      const rawResult = await rawResponse.json();

      const rawContent = rawResult.content[0].text;
      let smartContent = smartResult.content[0].text;
      
      // Try to parse as JSON if it's the structured output from TokenZip
      try {
        const parsed = JSON.parse(smartContent);
        if (parsed && typeof parsed === 'object' && parsed.content) {
          smartContent = parsed.content;
        }
      } catch (e) {
        // Not JSON, use as is
      }
      
      const rawTokens = rawContent.split(/\s+/).length;
      const smartTokens = smartContent.split(/\s+/).length;
      const savings = Math.round((1 - (smartTokens / rawTokens)) * 100);

      // Fetch symbols for this file for the dropdown
      if (db) {
        const symRes = await db.query<any[]>('SELECT name FROM symbol WHERE fileId = $fileId', { fileId: path.includes(':') ? path : `file:${path.replace(/\W/g, '_')}` });
        const names = (symRes[0] || []).map((s: any) => s.name);
        setFileSymbols(names);
        if (names.length > 0 && !names.includes(targetSymbol)) {
           // Don't auto-set targetSymbol to avoid unexpected re-renders, but keep it in mind
        }
      }

      setComparisonData({
        raw: rawContent,
        smart: smartContent,
        savings: isNaN(savings) ? 0 : savings,
        rawTokens,
        smartTokens
      });
    } catch (err: any) {
      setError('Connection Refused: Ensure TokenZip Demo Backend is running on port 6001.');
      console.error('Comparison failed:', err);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="playground-container">
      <div className="playground-header">
        <div className="logo-section">
          <Activity className="logo-icon" size={24} />
          <div className="logo-text">TokenZip<span>Playground</span></div>
        </div>
        <div className="mode-switcher">
          <button className={`mode-btn ${appMode === 'graph' ? 'active' : ''}`} onClick={() => setAppMode('graph')}>
            <BarChart3 size={16} /> Map
          </button>
          <button className={`mode-btn ${appMode === 'playground' ? 'active' : ''}`} onClick={() => setAppMode('playground')}>
            <Code2 size={16} /> Playground
          </button>
        </div>
        <div className="status-badge">
          <div className={`status-dot ${error ? 'error' : ''}`} style={{ backgroundColor: error ? '#ef4444' : '#10b981' }}></div>
          {error ? 'Backend Offline' : 'Live Demo Mode'}
        </div>
      </div>

      <div className="playground-content">
        <div className="explorer-panel">
          <div className="explorer-header">Repository Files</div>
          <div className="tree-view">
            {playgroundFiles.map(file => (
              <div 
                key={file.id} 
                className={`tree-node ${selectedFile === file.path ? 'active' : ''}`}
                onClick={() => handleFileSelect(file.path)}
              >
                <FileCode size={14} />
                <span>{file.path}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="playground-main">
          {error && (
             <div className="error-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={14} /> {error}
             </div>
          )}

          <div className="playground-toolbar" style={{ display: 'flex', gap: '20px', padding: '15px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <Layers size={14} /> Mode:
              <select 
                value={smartMode} 
                onChange={(e) => setSmartMode(e.target.value as any)}
                style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
              >
                <option value="auto">Auto (Balanced)</option>
                <option value="skeleton">Skeleton (Signatures)</option>
                <option value="interface_only">Interface Only</option>
                <option value="dependency_only">Dependency Only</option>
                <option value="implementation_of">Implementation Of</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <input 
                type="checkbox" 
                id="includeDocs"
                checked={includeDocs} 
                onChange={(e) => setIncludeDocs(e.target.checked)}
                style={{ accentColor: '#6366f1' }}
              />
              <label htmlFor="includeDocs" style={{ cursor: 'pointer' }}>Include Docs</label>
            </div>

            {smartMode === 'implementation_of' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <Settings size={14} /> Symbol:
                <select 
                  value={targetSymbol} 
                  onChange={(e) => setTargetSymbol(e.target.value)}
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px', outline: 'none', width: '150px' }}
                >
                  <option value="">Select Symbol...</option>
                  {fileSymbols.map(sym => (
                    <option key={sym} value={sym}>{sym}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <Sliders size={14} /> Token Budget:
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="100" 
                value={tokenBudget} 
                onChange={(e) => setTokenBudget(parseInt(e.target.value))}
                style={{ width: '100px', accentColor: '#6366f1' }}
              />
              <span style={{ minWidth: '40px', fontWeight: 600, color: '#f8fafc' }}>{tokenBudget}</span>
            </div>
          </div>

          {selectedFile ? (
            <>
              <div className="comparison-grid">
                <div className="pane">
                  <div className="pane-header">
                    <div className="pane-title"><Code2 size={16} /> file_read (Standard)</div>
                    <div className="token-badge" style={{ color: '#94a3b8' }}>
                      {comparisonData ? `${comparisonData.rawTokens} tokens` : 'Raw Implementation'}
                    </div>
                  </div>
                  <div className="code-box">
                    {isComparing ? 'Loading raw source...' : (comparisonData?.raw || 'Select a file')}
                  </div>
                </div>

                <div className="pane">
                  <div className="pane-header">
                    <div className="pane-title"><Zap size={16} color="#10b981" /> smart_file_read (Optimized)</div>
                    <div className="token-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                      {comparisonData ? `${comparisonData.smartTokens} tokens` : 'Semantic Projection'}
                    </div>
                  </div>
                  <div className="code-box highlight">
                    {isComparing ? 'Applying TokenZip algorithms...' : (comparisonData?.smart || 'Select a file')}
                  </div>
                </div>
              </div>

              {comparisonData && (
                <div className="savings-meter">
                  <div className="savings-value">{comparisonData.savings}%</div>
                  <div className="savings-label">Tokens Saved</div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4b5563' }}>
              <Cpu size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
              <p>Select a file from the explorer to see TokenZip in action.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Playground;
