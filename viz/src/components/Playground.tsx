import React, { useState, useEffect } from 'react';
import { 
  Activity, Code2, FileCode, Zap, Cpu, Settings, 
  Layers, Search, GitMerge, Info, Play, 
  Check, Copy, RefreshCw, FileText, 
  BookOpen, ChevronRight, AlertTriangle, Eye, Server, Compass
} from 'lucide-react';
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
  
  // Active Tool Selection
  const [activeTool, setActiveTool] = useState<'code_snapshot' | 'code_read' | 'code_search' | 'code_trace_flow' | 'code_insight' | 'legacy_compare'>('code_snapshot');
  
  // Global States
  const [isRunning, setIsRunning] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Smart Autocomplete Lists
  const [fileSymbols, setFileSymbols] = useState<string[]>([]);
  const [allRepoSymbols, setAllRepoSymbols] = useState<string[]>([]);

  // 1. Tool 1: code_snapshot Params
  const [snapshotPath, setSnapshotPath] = useState('src');
  const [snapshotDepth, setSnapshotDepth] = useState(2);
  const [snapshotFormat, setSnapshotFormat] = useState<'tree' | 'json'>('tree');

  // 2. Tool 2: code_read Params
  const [readPath, setReadPath] = useState('');
  const [readMode, setReadMode] = useState<'skeleton' | 'interface' | 'implementation'>('skeleton');
  const [readSymbol, setReadSymbol] = useState('');

  // 3. Tool 3: code_search Params
  const [searchQuery, setSearchQuery] = useState('');
  const [searchKind, setSearchKind] = useState<string>('');
  const [searchPathFilter, setSearchPathFilter] = useState('');
  const [searchLimit, setSearchLimit] = useState(15);

  // 4. Tool 4: code_trace_flow Params
  const [traceTarget, setTraceTarget] = useState('');
  const [traceDirection, setTraceDirection] = useState<'in' | 'out' | 'both'>('both');

  // 5. Tool 5: code_insight Params
  const [insightAction, setInsightAction] = useState<'recall' | 'save' | 'search' | 'forget'>('recall');
  const [insightTarget, setInsightTarget] = useState('');
  const [insightQuery, setInsightQuery] = useState('');
  const [insightId, setInsightId] = useState('');
  const [insightNoteTitle, setInsightNoteTitle] = useState('');
  const [insightNoteSummary, setInsightNoteSummary] = useState('');
  const [insightNoteCategory, setInsightNoteCategory] = useState<'guideline' | 'architecture' | 'gotcha' | 'todo'>('guideline');
  const [insightNoteScope, setInsightNoteScope] = useState<'file' | 'module' | 'codebase'>('file');

  // V1 Legacy Comparative State
  const [comparisonData, setComparisonData] = useState<{ 
    raw: string, 
    smart: string, 
    savings: number,
    rawTokens: number,
    smartTokens: number
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    fetchFilesAndSymbols();
  }, [db]);

  useEffect(() => {
    if (initialFile) {
      setSelectedFile(initialFile);
      setReadPath(initialFile);
      setSnapshotPath(initialFile.substring(0, initialFile.lastIndexOf('/')) || 'src');
      setInsightTarget(initialFile);
      fetchFileSymbols(initialFile);
    }
  }, [initialFile]);

  // Sync parameters when selected file changes in tree
  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    onFileChange(path);
    setReadPath(path);
    setInsightTarget(path);
    
    // Auto populate snapshot path with folder
    const folder = path.substring(0, path.lastIndexOf('/')) || 'src';
    setSnapshotPath(folder);
    
    fetchFileSymbols(path);

    // If active tool is read or legacy compare, trigger immediate execution for smooth workflow
    if (activeTool === 'code_read') {
      runCodeRead(path, readMode, readSymbol);
    } else if (activeTool === 'legacy_compare') {
      runLegacyCompare(path);
    } else if (activeTool === 'code_insight') {
      runCodeInsight('recall', path);
    }
  };

  const fetchFilesAndSymbols = async () => {
    if (!db) return;
    try {
      // Fetch files
      const fileRes = await db.query<any[]>('SELECT path FROM file LIMIT 100');
      const files = fileRes[0] || [];
      setPlaygroundFiles(files);
      
      if (files.length > 0 && !selectedFile && !initialFile) {
        setSelectedFile(files[0].path);
        setReadPath(files[0].path);
        setInsightTarget(files[0].path);
      }

      // Fetch all unique symbol names for autocomplete
      const symRes = await db.query<any[]>('SELECT name FROM symbol LIMIT 200');
      const symbols = (symRes[0] || []).map((s: any) => s.name);
      setAllRepoSymbols([...new Set(symbols as string[])]);
    } catch (err) {
      console.error('Failed to fetch files/symbols:', err);
    }
  };

  const fetchFileSymbols = async (filePath: string) => {
    if (!db) return;
    try {
      const symRes = await db.query<any[]>('SELECT name FROM symbol WHERE fileId = $fileId', { 
        fileId: filePath.includes(':') ? filePath : `file:${filePath.replace(/\W/g, '_')}` 
      });
      const names = (symRes[0] || []).map((s: any) => s.name);
      setFileSymbols(names);
      if (names.length > 0) {
        setReadSymbol(names[0]);
        setTraceTarget(names[0]);
      }
    } catch (err) {
      console.error('Failed to fetch file symbols:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 200);
  };

  // Tool Call Wrapper
  const executeToolCall = async (toolName: string, args: any) => {
    setIsRunning(true);
    setToolResult(null);
    setError(null);
    try {
      const response = await fetch(`http://localhost:6001/api/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: repoInfo?.name || 'openclaw',
          toolName,
          args
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server returned an error');
      }
      
      const res = await response.json();
      setToolResult(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Connection Refused: Ensure TokenZip Demo Backend is running.');
      console.error(`Tool execution failed for ${toolName}:`, err);
    } finally {
      setIsRunning(false);
    }
  };

  // Specific Tool Handlers
  const runSnapshot = () => {
    executeToolCall('code_snapshot', {
      path: snapshotPath,
      depth: snapshotDepth,
      format: snapshotFormat
    });
  };

  const runCodeRead = (pathOverride?: string, modeOverride?: string, symOverride?: string) => {
    executeToolCall('code_read', {
      path: pathOverride || readPath,
      mode: modeOverride || readMode,
      symbol: (modeOverride || readMode) === 'implementation' ? (symOverride || readSymbol) : undefined
    });
  };

  const runCodeSearch = () => {
    if (!searchQuery.trim()) {
      setError('Please provide a search query.');
      return;
    }
    executeToolCall('code_search', {
      query: searchQuery,
      kind: searchKind || undefined,
      path_filter: searchPathFilter || undefined,
      limit: searchLimit
    });
  };

  const runTraceFlow = () => {
    if (!traceTarget.trim()) {
      setError('Please specify a target symbol to trace.');
      return;
    }
    executeToolCall('code_trace_flow', {
      target: traceTarget,
      direction: traceDirection
    });
  };

  const runCodeInsight = (actionOverride?: string, targetOverride?: string) => {
    const action = actionOverride || insightAction;
    const args: any = { action };

    if (action === 'recall') {
      args.target = targetOverride || insightTarget;
      if (!args.target) {
        setError('Recall target is required.');
        return;
      }
    } else if (action === 'save') {
      args.target = targetOverride || insightTarget;
      if (!args.target || !insightNoteTitle || !insightNoteSummary) {
        setError('Target path, Title, and Summary are required to save an insight.');
        return;
      }
      args.note = {
        title: insightNoteTitle,
        summary: insightNoteSummary,
        category: insightNoteCategory,
        scope: insightNoteScope
      };
    } else if (action === 'search') {
      args.query = insightQuery;
      if (!args.query) {
        setError('Search query is required.');
        return;
      }
    } else if (action === 'forget') {
      args.id = insightId;
      if (!args.id) {
        setError('Note ID is required to forget.');
        return;
      }
    }

    executeToolCall('code_insight', args);
  };

  const runLegacyCompare = async (filePath: string) => {
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
            path: filePath,
            mode: 'auto',
            budget: 600,
            include_docs: false
          }
        })
      });
      if (!response.ok) throw new Error('Optimized read failed');
      const smartResult = await response.json();
      
      const rawResponse = await fetch(`http://localhost:6001/api/tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: repoInfo?.name || 'openclaw',
          toolName: 'file_read',
          args: { path: filePath }
        })
      });
      if (!rawResponse.ok) throw new Error('Raw read failed');
      const rawResult = await rawResponse.json();

      const rawContent = rawResult.content[0].text;
      let smartContent = smartResult.content[0].text;
      
      try {
        const parsed = JSON.parse(smartContent);
        if (parsed && typeof parsed === 'object' && parsed.content) {
          smartContent = parsed.content;
        }
      } catch (e) { }
      
      const rawTokens = rawContent.split(/\s+/).length;
      const smartTokens = smartContent.split(/\s+/).length;
      const savings = Math.round((1 - (smartTokens / rawTokens)) * 100);

      setComparisonData({
        raw: rawContent,
        smart: smartContent,
        savings: isNaN(savings) ? 0 : savings,
        rawTokens,
        smartTokens
      });
    } catch (err: any) {
      setError(err.message || 'Legacy comparison error.');
    } finally {
      setIsComparing(false);
    }
  };

  // Switch tool tabs and clear previous outputs
  const handleTabChange = (tool: typeof activeTool) => {
    setActiveTool(tool);
    setToolResult(null);
    setError(null);
    
    // Auto execute read or legacy compare on switch
    if (selectedFile) {
      if (tool === 'code_read') {
        runCodeRead(selectedFile, readMode, readSymbol);
      } else if (tool === 'legacy_compare') {
        runLegacyCompare(selectedFile);
      } else if (tool === 'code_insight' && insightAction === 'recall') {
        runCodeInsight('recall', selectedFile);
      }
    }
  };

  // Helper to extract clean text response
  const getCleanResultText = () => {
    if (!toolResult) return '';
    if (Array.isArray(toolResult.content) && toolResult.content[0]) {
      return toolResult.content[0].text || '';
    }
    return JSON.stringify(toolResult, null, 2);
  };

  return (
    <div className="playground-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#09090d', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Playground Header */}
      <div className="playground-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#0d0d12', borderBottom: '1px solid rgba(255,255,255,0.08)', height: '64px' }}>
        <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity className="logo-icon" size={22} style={{ color: '#6366f1' }} />
          <div className="logo-text" style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
            RecallKit <span style={{ color: '#a855f7', fontWeight: 500, fontSize: '0.85rem', padding: '2px 6px', background: 'rgba(168,85,247,0.1)', borderRadius: '6px', marginLeft: '6px' }}>V2 DEV</span>
          </div>
        </div>
        
        {/* Toggle between interactive 3D Graph and Sandbox Playground */}
        <div className="mode-switcher" style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px' }}>
          <button className={`mode-btn ${appMode === 'graph' ? 'active' : ''}`} onClick={() => setAppMode('graph')} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: appMode === 'graph' ? '#6366f1' : 'transparent', color: appMode === 'graph' ? 'white' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Compass size={14} /> View Map
          </button>
          <button className={`mode-btn ${appMode === 'playground' ? 'active' : ''}`} onClick={() => setAppMode('playground')} style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: appMode === 'playground' ? '#6366f1' : 'transparent', color: appMode === 'playground' ? 'white' : '#94a3b8', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <Cpu size={14} /> Sandbox Playground
          </button>
        </div>

        <div className="status-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', color: '#94a3b8' }}>
          <Server size={12} style={{ color: '#10b981' }} />
          <span>Interactive Server Portal</span>
        </div>
      </div>

      <div className="playground-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Explorer Sidebar */}
        <div className="explorer-panel" style={{ width: '280px', background: '#0c0c10', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="explorer-header" style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Source Code Index</span>
            <RefreshCw size={12} style={{ cursor: 'pointer', color: '#6366f1' }} onClick={fetchFilesAndSymbols} />
          </div>
          <div className="tree-view" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {playgroundFiles.map(file => (
              <div 
                key={file.path} 
                className={`tree-node ${selectedFile === file.path ? 'active' : ''}`}
                onClick={() => handleFileSelect(file.path)}
                style={{ 
                  padding: '7px 10px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '0.8rem', 
                  color: selectedFile === file.path ? '#818cf8' : '#94a3b8', 
                  background: selectedFile === file.path ? 'rgba(99,102,241,0.08)' : 'transparent',
                  marginBottom: '2px',
                  transition: 'all 0.15s ease' 
                }}
              >
                <FileCode size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Playground Workspace */}
        <div className="playground-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px', background: 'radial-gradient(circle at 70% 10%, rgba(99,102,241,0.03), transparent 50%)', position: 'relative' }}>
          
          {/* Action Tabs for the 5 V2 Tools */}
          <div className="tool-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '20px' }}>
            <button 
              className={`tab-btn ${activeTool === 'code_snapshot' ? 'active' : ''}`} 
              onClick={() => handleTabChange('code_snapshot')}
              style={{
                background: activeTool === 'code_snapshot' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTool === 'code_snapshot' ? '#818cf8' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'code_snapshot' ? '2px solid #6366f1' : 'none'
              }}
            >
              <Compass size={14} /> code_snapshot
            </button>
            <button 
              className={`tab-btn ${activeTool === 'code_read' ? 'active' : ''}`} 
              onClick={() => handleTabChange('code_read')}
              style={{
                background: activeTool === 'code_read' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTool === 'code_read' ? '#818cf8' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'code_read' ? '2px solid #6366f1' : 'none'
              }}
            >
              <BookOpen size={14} /> code_read
            </button>
            <button 
              className={`tab-btn ${activeTool === 'code_search' ? 'active' : ''}`} 
              onClick={() => handleTabChange('code_search')}
              style={{
                background: activeTool === 'code_search' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTool === 'code_search' ? '#818cf8' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'code_search' ? '2px solid #6366f1' : 'none'
              }}
            >
              <Search size={14} /> code_search
            </button>
            <button 
              className={`tab-btn ${activeTool === 'code_trace_flow' ? 'active' : ''}`} 
              onClick={() => handleTabChange('code_trace_flow')}
              style={{
                background: activeTool === 'code_trace_flow' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTool === 'code_trace_flow' ? '#818cf8' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'code_trace_flow' ? '2px solid #6366f1' : 'none'
              }}
            >
              <GitMerge size={14} /> code_trace_flow
            </button>
            <button 
              className={`tab-btn ${activeTool === 'code_insight' ? 'active' : ''}`} 
              onClick={() => handleTabChange('code_insight')}
              style={{
                background: activeTool === 'code_insight' ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: activeTool === 'code_insight' ? '#818cf8' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'code_insight' ? '2px solid #6366f1' : 'none'
              }}
            >
              <Layers size={14} /> code_insight
            </button>
            <button 
              className={`tab-btn ${activeTool === 'legacy_compare' ? 'active' : ''}`} 
              onClick={() => handleTabChange('legacy_compare')}
              style={{
                background: activeTool === 'legacy_compare' ? 'rgba(239,68,68,0.06)' : 'transparent',
                color: activeTool === 'legacy_compare' ? '#ef4444' : '#94a3b8',
                border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: activeTool === 'legacy_compare' ? '2px solid #ef4444' : 'none',
                marginLeft: 'auto'
              }}
            >
              <Zap size={14} /> ROI Token Comparison
            </button>
          </div>

          {/* Interactive Parameters Configuration Panel */}
          <div className="params-panel" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} style={{ color: '#a855f7' }} /> Inputs Configuration
              </h3>
              <button 
                onClick={() => {
                  if (activeTool === 'code_snapshot') runSnapshot();
                  else if (activeTool === 'code_read') runCodeRead();
                  else if (activeTool === 'code_search') runCodeSearch();
                  else if (activeTool === 'code_trace_flow') runTraceFlow();
                  else if (activeTool === 'code_insight') runCodeInsight();
                }}
                disabled={isRunning}
                style={{
                  background: '#6366f1', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px',
                  fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)', transition: 'all 0.2s'
                }}
              >
                {isRunning ? <RefreshCw size={14} className="spinning" /> : <Play size={14} />} Execute Tool
              </button>
            </div>

            {/* Dynamic Input Fields based on active tool */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              
              {/* SNAPSHOT TOOL INPUTS */}
              {activeTool === 'code_snapshot' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Directory Path:</label>
                    <input 
                      type="text" 
                      value={snapshotPath} 
                      onChange={(e) => setSnapshotPath(e.target.value)}
                      placeholder="e.g. src"
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Tree Format:</label>
                    <div style={{ display: 'flex', background: '#121218', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <button 
                        onClick={() => setSnapshotFormat('tree')}
                        style={{ flex: 1, border: 'none', background: snapshotFormat === 'tree' ? 'rgba(99,102,241,0.2)' : 'transparent', color: snapshotFormat === 'tree' ? '#818cf8' : '#94a3b8', fontSize: '0.75rem', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ASCII Tree
                      </button>
                      <button 
                        onClick={() => setSnapshotFormat('json')}
                        style={{ flex: 1, border: 'none', background: snapshotFormat === 'json' ? 'rgba(99,102,241,0.2)' : 'transparent', color: snapshotFormat === 'json' ? '#818cf8' : '#94a3b8', fontSize: '0.75rem', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        JSON Format
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Traversal Depth: <span style={{ color: '#a855f7' }}>{snapshotDepth}</span></label>
                    <input 
                      type="range" min="1" max="5" 
                      value={snapshotDepth} 
                      onChange={(e) => setSnapshotDepth(parseInt(e.target.value))}
                      style={{ width: '100%', height: '6px', background: '#121218', borderRadius: '5px', accentColor: '#6366f1', cursor: 'pointer', marginTop: '10px' }}
                    />
                  </div>
                </>
              )}

              {/* CODE READ TOOL INPUTS */}
              {activeTool === 'code_read' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>File Path:</label>
                    <input 
                      type="text" 
                      value={readPath} 
                      onChange={(e) => setReadPath(e.target.value)}
                      placeholder="e.g. src/index.ts"
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Reading Mode:</label>
                    <select 
                      value={readMode} 
                      onChange={(e) => setReadMode(e.target.value as any)}
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="skeleton">Skeleton (Token Optimized)</option>
                      <option value="interface">Interface Only (API Specs)</option>
                      <option value="implementation">Implementation Of Symbol</option>
                    </select>
                  </div>
                  {readMode === 'implementation' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Target Symbol in File:</label>
                      <select 
                        value={readSymbol} 
                        onChange={(e) => setReadSymbol(e.target.value)}
                        style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                      >
                        {fileSymbols.length === 0 ? (
                          <option value="">No symbols parsed in file</option>
                        ) : (
                          fileSymbols.map(sym => (
                            <option key={sym} value={sym}>{sym}</option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* CODE SEARCH TOOL INPUTS */}
              {activeTool === 'code_search' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Search Term / Query:</label>
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. registerTools"
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Symbol Kind Filter:</label>
                    <select 
                      value={searchKind} 
                      onChange={(e) => setSearchKind(e.target.value)}
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">All Types</option>
                      <option value="function">Function / Method</option>
                      <option value="class">Class</option>
                      <option value="interface">Interface</option>
                      <option value="variable">Variable / Constant</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Path Pattern Filter:</label>
                    <input 
                      type="text" 
                      value={searchPathFilter} 
                      onChange={(e) => setSearchPathFilter(e.target.value)}
                      placeholder="e.g. src/mcp"
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Result Limit:</label>
                    <input 
                      type="number" 
                      value={searchLimit} 
                      onChange={(e) => setSearchLimit(parseInt(e.target.value) || 15)}
                      min="1" max="100"
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                </>
              )}

              {/* CODE TRACE FLOW TOOL INPUTS */}
              {activeTool === 'code_trace_flow' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Target Symbol Name:</label>
                    <input 
                      type="text" 
                      value={traceTarget} 
                      onChange={(e) => setTraceTarget(e.target.value)}
                      list="symbols-autocomplete"
                      placeholder="Type a symbol name..."
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                    />
                    <datalist id="symbols-autocomplete">
                      {allRepoSymbols.map(sym => (
                        <option key={sym} value={sym} />
                      ))}
                    </datalist>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Trace Direction:</label>
                    <select 
                      value={traceDirection} 
                      onChange={(e) => setTraceDirection(e.target.value as any)}
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="both">Both Incoming & Outgoing</option>
                      <option value="in">Incoming Calls (Callers)</option>
                      <option value="out">Outgoing Calls (Callees)</option>
                    </select>
                  </div>
                </>
              )}

              {/* CODE INSIGHT TOOL INPUTS */}
              {activeTool === 'code_insight' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Action:</label>
                    <select 
                      value={insightAction} 
                      onChange={(e) => setInsightAction(e.target.value as any)}
                      style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="recall">Recall Insights for Path</option>
                      <option value="save">Save/Store New Architectural Note</option>
                      <option value="search">Search Insights Registry</option>
                      <option value="forget">Forget / Archive Insight</option>
                    </select>
                  </div>

                  {insightAction === 'recall' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>File or Module Path:</label>
                      <input 
                        type="text" 
                        value={insightTarget} 
                        onChange={(e) => setInsightTarget(e.target.value)}
                        placeholder="e.g. src/mcp"
                        style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  )}

                  {insightAction === 'search' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Insight Keywords Search:</label>
                      <input 
                        type="text" 
                        value={insightQuery} 
                        onChange={(e) => setInsightQuery(e.target.value)}
                        placeholder="Search title or details..."
                        style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  )}

                  {insightAction === 'forget' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Note Surreal Record ID:</label>
                      <input 
                        type="text" 
                        value={insightId} 
                        onChange={(e) => setInsightId(e.target.value)}
                        placeholder="e.g. annotation:xxxx"
                        style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  )}

                  {insightAction === 'save' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Target Scope Path:</label>
                        <input 
                          type="text" 
                          value={insightTarget} 
                          onChange={(e) => setInsightTarget(e.target.value)}
                          placeholder="e.g. src/mcp"
                          style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Note Category:</label>
                        <select 
                          value={insightNoteCategory} 
                          onChange={(e) => setInsightNoteCategory(e.target.value as any)}
                          style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                        >
                          <option value="guideline">General Guideline</option>
                          <option value="architecture">Architectural Note</option>
                          <option value="gotcha">Bug Gotcha / Trap</option>
                          <option value="todo">Task / Todo list</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* LEGACY COMPARE PARAMETERS */}
              {activeTool === 'legacy_compare' && (
                <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                  <Info size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    Comparing standard complete <code style={{ color: '#fff' }}>file_read</code> against intent-driven skeleton <code style={{ color: '#34d399' }}>smart_file_read</code>. Select any file on the left tree to automatically analyze real-time token savings and ROI metrics.
                  </p>
                </div>
              )}

            </div>

            {/* NESTED NOTE SUBMISSION FORM (ONLY FOR SAVE ACTION IN CODE INSIGHT) */}
            {activeTool === 'code_insight' && insightAction === 'save' && (
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Note Title:</label>
                  <input 
                    type="text" 
                    value={insightNoteTitle} 
                    onChange={(e) => setInsightNoteTitle(e.target.value)}
                    placeholder="Gotcha with null DB connections..."
                    style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Note Detailed Summary:</label>
                  <textarea 
                    value={insightNoteSummary} 
                    onChange={(e) => setInsightNoteSummary(e.target.value)}
                    placeholder="Describe specific rules, implementation constraints, or gotchas..."
                    rows={2}
                    style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Note Inheritance Scope:</label>
                  <select 
                    value={insightNoteScope} 
                    onChange={(e) => setInsightNoteScope(e.target.value as any)}
                    style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="file">Strict File Scope</option>
                    <option value="module">Module Recursive Scope</option>
                    <option value="codebase">Global Codebase Scope</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
             <div className="error-banner" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '14px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> <span>{error}</span>
             </div>
          )}

          {/* DYNAMIC VISUAL LAYOUT & RESULTS VIEWER */}
          <div className="playground-viewer" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
            
            {/* 1. LEGACY COMP COMPARATIVE VIEW */}
            {activeTool === 'legacy_compare' ? (
              selectedFile ? (
                <>
                  <div className="comparison-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
                    {/* Raw Column */}
                    <div className="pane" style={{ background: '#0e0e14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div className="pane-header" style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="pane-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                          <Code2 size={15} /> file_read (Standard V1)
                        </div>
                        <div className="token-badge" style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '12px' }}>
                          {comparisonData ? `${comparisonData.rawTokens} tokens` : 'Raw Input'}
                        </div>
                      </div>
                      <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.5' }}>
                        {isComparing ? 'Downloading full original file...' : (comparisonData?.raw || 'Select a file')}
                      </pre>
                    </div>

                    {/* V2 Smart Read Column */}
                    <div className="pane" style={{ background: '#0e0e14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div className="pane-header" style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="pane-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
                          <Zap size={15} /> smart_file_read (Optimized V2)
                        </div>
                        <div className="token-badge" style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                          {comparisonData ? `${comparisonData.smartTokens} tokens` : 'Skeleton Input'}
                        </div>
                      </div>
                      <pre className="code-box highlight" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#a7f3d0', lineHeight: '1.5' }}>
                        {isComparing ? 'Running V2 context optimizer algorithms...' : (comparisonData?.smart || 'Select a file')}
                      </pre>
                    </div>
                  </div>

                  {comparisonData && (
                    <div className="savings-meter" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 24px', background: 'linear-gradient(90deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))', borderRadius: '16px', border: '1px solid rgba(99,102,241,0.15)', marginTop: '20px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Zap size={20} style={{ color: '#a855f7' }} />
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>{comparisonData.savings}% Token Compression</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>V2 Context compression reduces prompt budget overhead while keeping full semantic capabilities.</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>-{comparisonData.savings}%</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '300px', color: '#4b5563', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                  <Cpu size={48} style={{ opacity: 0.15, marginBottom: '14px' }} />
                  <p style={{ fontSize: '0.8rem' }}>Select a file from the index tree on the left sidebar to test V2 token efficiency.</p>
                </div>
              )
            ) : (
              
              /* 2. DYNAMIC WORKSPACE RENDERER FOR V2 TOOLS */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                
                {/* Result Control Bar */}
                {toolResult && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Eye size={12} /> Live API Result Output ({toolResult._token_count || 0} tokens used)
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => copyToClipboard(getCleanResultText())}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Code/Tree Window */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: '300px' }}>
                  
                  {isRunning ? (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,13,0.7)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', borderRadius: '16px', zIndex: 10 }}>
                      <RefreshCw size={32} className="spinning" style={{ color: '#6366f1' }} />
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Invoking Model MCP Server Portal...</p>
                    </div>
                  ) : null}

                  {toolResult ? (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px' }}>
                      
                      {/* V2 Output Rendering logic depending on chosen tool */}
                      {activeTool === 'code_snapshot' && snapshotFormat === 'tree' ? (
                        /* Beautified ASCII Tree rendering */
                        <pre className="code-box" style={{ flex: 1, margin: 0, padding: '20px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {getCleanResultText()}
                        </pre>
                      ) : activeTool === 'code_search' && toolResult.matches ? (
                        /* Beautified Search Cards rendering */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Found {toolResult.matchCount || 0} matching code structures in the index:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                            {toolResult.matches.map((match: any) => (
                              <div 
                                key={match.id}
                                style={{ 
                                  background: 'rgba(255,255,255,0.02)', 
                                  border: '1px solid rgba(255,255,255,0.06)', 
                                  borderRadius: '12px', 
                                  padding: '14px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onClick={() => {
                                  handleTabChange('code_read');
                                  setReadPath(match.filePath);
                                  runCodeRead(match.filePath, 'skeleton');
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{match.name}</span>
                                  <span style={{ 
                                    fontSize: '0.6rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
                                    background: match.kind === 'class' ? 'rgba(168,85,247,0.15)' : 'rgba(99,102,241,0.15)',
                                    color: match.kind === 'class' ? '#c084fc' : '#818cf8'
                                  }}>
                                    {match.kind}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <FileText size={10} /> {match.filePath}
                                </div>
                                {match.signature && (
                                  <pre style={{ margin: '8px 0 0 0', padding: '6px', background: '#050507', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.65rem', color: '#a7f3d0', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {match.signature}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : activeTool === 'code_trace_flow' && (toolResult.incoming || toolResult.outgoing) ? (
                        /* Interactive execution flow rendering */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                          
                          {/* Core Traced Symbol Card */}
                          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px' }}>Traced Symbol</div>
                            <h2 style={{ fontSize: '1.2rem', color: 'white', fontWeight: 800 }}>{toolResult.symbol}</h2>
                            {toolResult.implementations && toolResult.implementations.length > 0 && (
                              <div style={{ display: 'inline-flex', gap: '6px', marginTop: '8px' }}>
                                {toolResult.implementations.map((impl: any) => (
                                  <span key={impl.name} style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '12px' }}>
                                    Implements {impl.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Callers (Incoming) */}
                            <div style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
                              <h4 style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ChevronRight size={12} /> Callers (Incoming)
                              </h4>
                              {toolResult.incoming && toolResult.incoming.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {toolResult.incoming.map((caller: any) => (
                                    <div key={caller.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.75rem' }}>
                                      <span style={{ color: 'white', fontWeight: 600 }}>{caller.name}</span>
                                      <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>({caller.filePath})</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.7rem', color: '#4b5563', fontStyle: 'italic' }}>No incoming callers recorded in index.</div>
                              )}
                            </div>

                            {/* Callees (Outgoing) */}
                            <div style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
                              <h4 style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ChevronRight size={12} /> Outgoing Calls (Callees)
                              </h4>
                              {toolResult.outgoing && toolResult.outgoing.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {toolResult.outgoing.map((callee: any) => (
                                    <div key={callee.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.75rem' }}>
                                      <span style={{ color: 'white', fontWeight: 600 }}>{callee.name}</span>
                                      <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>({callee.filePath})</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.7rem', color: '#4b5563', fontStyle: 'italic' }}>No outgoing calls parsed.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Standard JSON/Code output render */
                        <pre className="code-box" style={{ flex: 1, margin: 0, padding: '20px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {getCleanResultText()}
                        </pre>
                      )}

                      {/* Interactive Cortex Notes Renderer - if returned by server */}
                      {(toolResult._cortex || toolResult._insights || (toolResult.insights && toolResult.insights.length > 0)) && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                            <BookOpen size={14} /> Persistent Cortex Architecture Rules ({((toolResult._cortex?.notes || toolResult._insights || toolResult.insights || []) as any).length} loaded)
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                            {((toolResult._cortex?.notes || toolResult._insights || toolResult.insights || []) as any).map((insight: any, i: number) => {
                              const noteObj = typeof insight === 'string' ? { title: 'Architectural Note', summary: insight, category: 'guideline' } : insight;
                              return (
                                <div 
                                  key={i}
                                  style={{ 
                                    padding: '12px 14px', 
                                    borderRadius: '8px', 
                                    background: 'rgba(255,255,255,0.02)', 
                                    borderLeft: `4px solid ${
                                      noteObj.category === 'gotcha' ? '#f59e0b' : 
                                      noteObj.category === 'todo' ? '#3b82f6' : '#10b981'
                                    }`,
                                    borderTop: '1px solid rgba(255,255,255,0.04)',
                                    borderRight: '1px solid rgba(255,255,255,0.04)',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                                  }}
                                >
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span>{noteObj.title}</span>
                                    <span style={{ 
                                      fontSize: '0.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase',
                                      background: noteObj.category === 'gotcha' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                                      color: noteObj.category === 'gotcha' ? '#f59e0b' : '#10b981'
                                    }}>
                                      {noteObj.category}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: '1.4' }}>{noteObj.summary}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#4b5563', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '16px', height: '100%', minHeight: '300px' }}>
                      <Cpu size={48} style={{ opacity: 0.15, marginBottom: '14px' }} />
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Configure parameters and click "Execute Tool" to invoke RecallKit MCP Server.</p>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default Playground;
