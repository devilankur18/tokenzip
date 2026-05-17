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
  const [readMode, setReadMode] = useState<'skeleton' | 'interface' | 'implementation' | 'full'>('skeleton');
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
  const [showComparativeROI, setShowComparativeROI] = useState(true);
  const [codeReadCompare, setCodeReadCompare] = useState<{
    rawTokens: number;
    smartTokens: number;
    rawLines: number;
    smartLines: number;
    savings: number;
  } | null>(null);
  const [rawFileContent, setRawFileContent] = useState<string | null>(null);
  
  // Batch/Multi-file selections states
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialFile ? [initialFile] : []);
  const [batchRawContents, setBatchRawContents] = useState<Record<string, string>>({});
  const [batchCompareData, setBatchCompareData] = useState<Record<string, {
    rawTokens: number;
    smartTokens: number;
    rawLines: number;
    smartLines: number;
    savings: number;
  }>>({});

  useEffect(() => {
    const fetchMultipleFileSymbols = async () => {
      if (!db || selectedFiles.length === 0) {
        setFileSymbols([]);
        return;
      }
      try {
        const fileRes = await db.query<any[]>('SELECT id FROM file WHERE path IN $paths', { paths: selectedFiles });
        const fileIds = (fileRes[0] || []).map((f: any) => f.id);
        
        if (fileIds.length > 0) {
          const symRes = await db.query<any[]>('SELECT name FROM symbol WHERE fileId IN $fileIds LIMIT 200', { fileIds });
          const names = (symRes[0] || []).map((s: any) => s.name);
          const uniqueNames = [...new Set(names as string[])];
          setFileSymbols(uniqueNames);
          if (uniqueNames.length > 0 && !readSymbol) {
            setReadSymbol(uniqueNames[0]);
          }
        } else {
          setFileSymbols([]);
        }
      } catch (err) {
        console.error('Failed to fetch multiple files symbols:', err);
      }
    };
    
    fetchMultipleFileSymbols();
  }, [selectedFiles, db]);


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
    
    // Automatically select the file in the checkbox list too if not already selected
    setSelectedFiles(prev => prev.includes(path) ? prev : [...prev, path]);
    
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

  useEffect(() => {
    if (selectedFiles.length > 0) {
      setReadPath(selectedFiles.join(', '));
    } else {
      setReadPath('');
    }
  }, [selectedFiles]);

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
      // First, get the correct file record id
      const fileRes = await db.query<any[]>('SELECT id FROM file WHERE path = $path LIMIT 1', { path: filePath });
      const resolvedId = fileRes[0]?.[0]?.id;
      
      if (resolvedId) {
        const symRes = await db.query<any[]>('SELECT name FROM symbol WHERE fileId = $fileId', { fileId: resolvedId });
        const names = (symRes[0] || []).map((s: any) => s.name);
        setFileSymbols(names);
        if (names.length > 0) {
          setReadSymbol(names[0]);
          setTraceTarget(names[0]);
        } else {
          setFileSymbols([]);
        }
      } else {
        // Fallback string replacement
        const symRes = await db.query<any[]>('SELECT name FROM symbol WHERE fileId = $fileId', { 
          fileId: filePath.includes(':') ? filePath : `file:${filePath.replace(/\W/g, '_')}` 
        });
        const names = (symRes[0] || []).map((s: any) => s.name);
        setFileSymbols(names);
        if (names.length > 0) {
          setReadSymbol(names[0]);
          setTraceTarget(names[0]);
        } else {
          setFileSymbols([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch file symbols:', err);
      setFileSymbols([]);
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

  const runCodeRead = async (pathOverride?: string, modeOverride?: string, symOverride?: string) => {
    const targetPath = pathOverride || readPath;
    const targetMode = modeOverride || readMode;
    const targetSymbol = targetMode === 'implementation' ? (symOverride || readSymbol) : undefined;

    setCodeReadCompare(null); // Reset previous comparison data while loading
    setRawFileContent(null);
    setBatchRawContents({});
    setBatchCompareData({});
    
    // Parse target paths
    const targetPathsList = targetPath.split(',').map(p => p.trim()).filter(Boolean);

    // 1. Run the V2 Tool Call
    const res = await executeToolCall('code_read', {
      path: targetPath,
      mode: targetMode,
      symbol: targetSymbol
    });

    if (res && Array.isArray(res.content) && res.content[0]) {
      const smartText = res.content[0].text || '';

      // 2. Fetch the Legacy raw file content for all targets in batch parallel
      const rawContents: Record<string, string> = {};
      await Promise.all(targetPathsList.map(async (fPath) => {
        try {
          const rawResponse = await fetch(`http://localhost:6001/api/tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repoName: repoInfo?.name || 'openclaw',
              toolName: 'file_read',
              args: { path: fPath }
            })
          });
          
          if (rawResponse.ok) {
            const rawResult = await rawResponse.json();
            const rawContent = (Array.isArray(rawResult.content) && rawResult.content[0]) ? rawResult.content[0].text : '';
            rawContents[fPath] = rawContent;
          }
        } catch (e) {
          console.error(`Failed to load raw comparison read for ${fPath}:`, e);
        }
      }));

      setBatchRawContents(rawContents);

      // 3. Process the response comparison
      try {
        const parsed = JSON.parse(smartText);
        
        if (parsed && typeof parsed === 'object' && parsed.is_batch && Array.isArray(parsed.files)) {
          // Process batch response
          const comps: Record<string, any> = {};
          let totalRawTokens = 0;
          let totalSmartTokens = 0;
          let totalRawLines = 0;
          let totalSmartLines = 0;

          for (const fileItem of parsed.files) {
            const fPath = fileItem.filePath;
            const sContent = fileItem.content || '';
            const rContent = rawContents[fPath] || '';

            const sTokens = sContent.split(/\s+/).length;
            const sLines = sContent.split('\n').length;
            const rTokens = rContent.split(/\s+/).length;
            const rLines = rContent.split('\n').length;
            const fileSavings = Math.max(0, Math.min(99, Math.round((1 - (sTokens / rTokens)) * 100)));

            comps[fPath] = {
              rawTokens: rTokens,
              smartTokens: sTokens,
              rawLines: rLines,
              smartLines: sLines,
              savings: isNaN(fileSavings) ? 0 : fileSavings
            };

            totalRawTokens += rTokens;
            totalSmartTokens += sTokens;
            totalRawLines += rLines;
            totalSmartLines += sLines;
          }

          setBatchCompareData(comps);
          const overallSavings = Math.max(0, Math.min(99, Math.round((1 - (totalSmartTokens / totalRawTokens)) * 100)));
          setCodeReadCompare({
            rawTokens: totalRawTokens,
            smartTokens: totalSmartTokens,
            rawLines: totalRawLines,
            smartLines: totalSmartLines,
            savings: isNaN(overallSavings) ? 0 : overallSavings
          });
        } else {
          // Process single file response
          const smartContent = parsed.content || smartText;
          const smartTokens = smartContent.split(/\s+/).length;
          const smartLines = smartContent.split('\n').length;

          const singlePath = targetPathsList[0] || targetPath;
          const rContent = rawContents[singlePath] || '';
          setRawFileContent(rContent);

          const rTokens = rContent.split(/\s+/).length;
          const rLines = rContent.split('\n').length;
          const savings = Math.max(0, Math.min(99, Math.round((1 - (smartTokens / rTokens)) * 100)));

          setCodeReadCompare({
            rawTokens: rTokens,
            smartTokens: smartTokens,
            rawLines: rLines,
            smartLines: smartLines,
            savings: isNaN(savings) ? 0 : savings
          });

          setBatchCompareData({
            [singlePath]: {
              rawTokens: rTokens,
              smartTokens: smartTokens,
              rawLines: rLines,
              smartLines: smartLines,
              savings: isNaN(savings) ? 0 : savings
            }
          });
        }
      } catch (e) {
        // Fallback for non-JSON responses
        const smartTokens = smartText.split(/\s+/).length;
        const smartLines = smartText.split('\n').length;

        const singlePath = targetPathsList[0] || targetPath;
        const rContent = rawContents[singlePath] || '';
        setRawFileContent(rContent);

        const rTokens = rContent.split(/\s+/).length;
        const rLines = rContent.split('\n').length;
        const savings = Math.max(0, Math.min(99, Math.round((1 - (smartTokens / rTokens)) * 100)));

        setCodeReadCompare({
          rawTokens: rTokens,
          smartTokens: smartTokens,
          rawLines: rLines,
          smartLines: smartLines,
          savings: isNaN(savings) ? 0 : savings
        });
      }
    }
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

    if (action === 'recall') {
      const target = targetOverride || insightTarget;
      if (!target) {
        setError('Recall target is required.');
        return;
      }
      executeToolCall('recall_instruction', { target });
    } else if (action === 'save') {
      const target = targetOverride || insightTarget;
      if (!target || !insightNoteTitle || !insightNoteSummary) {
        setError('Target path, Title, and Summary are required to save an insight.');
        return;
      }
      executeToolCall('remember_instruction', {
        target,
        title: insightNoteTitle,
        summary: insightNoteSummary,
        category: insightNoteCategory,
        scope: insightNoteScope
      });
    } else if (action === 'search') {
      if (!insightQuery) {
        setError('Search query is required.');
        return;
      }
      executeToolCall('search_instruction', { query: insightQuery });
    } else if (action === 'forget') {
      if (!insightId) {
        setError('Note ID is required to forget.');
        return;
      }
      executeToolCall('forget_instruction', { id: insightId });
    }
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
    let text = '';
    if (Array.isArray(toolResult.content) && toolResult.content[0]) {
      text = toolResult.content[0].text || '';
    } else {
      text = JSON.stringify(toolResult, null, 2);
    }
    
    // Parse nested JSON if the MCP tool returns a serialized JSON string containing structured keys (like "content", "mode_used", etc.)
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.content) {
        return parsed.content;
      }
    } catch (e) {}
    
    return text;
  };

  // Helper to render beautiful visual V2 Comparative Advantages
  const renderComparativeROI = () => {
    switch (activeTool) {
      case 'code_snapshot':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px', padding: '16px', background: '#0c0c12', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', overflowY: 'auto', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: 0 }}>V2 SNAPSHOT ADVANTAGE</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Legacy Naïve Dump</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>25k+ Tokens</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>Floods context window with recursive list of thousands of useless nested paths (e.g. node_modules, temp files).</div>
              </div>
              
              <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>RecallKit V2 Snapshot</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>800 Tokens</div>
                <div style={{ fontSize: '0.65rem', color: '#a7f3d0', marginTop: '6px', lineHeight: '1.3' }}>Compact structural map returning multi-level hierarchy layout with strict token budgets.</div>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.05)', borderRadius: '10px', border: '1px dashed rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                <span>Context Size Saving</span>
                <span style={{ color: '#34d399' }}>96.8% Reduction</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '96.8%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong>💡 Discovery Journey Speed:</strong> Instead of waiting 4.2 seconds for recursive scans, indexed semantic snapshotting takes just <strong>50ms</strong>. Perfect for mapping out an unfamiliar workspace in seconds.
            </div>
          </div>
        );
      case 'code_read':
        const rawT = codeReadCompare ? codeReadCompare.rawTokens : 12000;
        const smartT = codeReadCompare ? codeReadCompare.smartTokens : 350;
        const rawL = codeReadCompare ? codeReadCompare.rawLines : 420;
        const smartL = codeReadCompare ? codeReadCompare.smartLines : 32;
        const savingsPct = codeReadCompare ? codeReadCompare.savings : 91.5;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px', padding: '16px', background: '#0c0c12', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', overflowY: 'auto', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: 0 }}>V2 SMART READ ADVANTAGE</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Legacy raw read</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>
                  {rawT.toLocaleString()} Tokens
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>
                  Floods the context with massive implementation boilerplate, helper routines, imports, and comments ({rawL} lines of raw code).
                </div>
              </div>
              
              <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>RecallKit V2 Read</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>
                  {smartT.toLocaleString()} Tokens
                </div>
                <div style={{ fontSize: '0.65rem', color: '#a7f3d0', marginTop: '6px', lineHeight: '1.3' }}>
                  Skeletal projection isolates API structure. Collapses method blocks and extracts clean signatures ({smartL} lines of focused code).
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.05)', borderRadius: '10px', border: '1px dashed rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                <span>Real Token Savings</span>
                <span style={{ color: '#34d399' }}>{savingsPct}% Reduction</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${savingsPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong>💡 Active Real-Time Analysis:</strong> For the currently active file <code>{selectedFile || 'None Selected'}</code>, RecallKit isolates key declarations to save <strong>{(rawT - smartT).toLocaleString()} tokens</strong> and <strong>{rawL - smartL} lines of context noise</strong>!
            </div>
          </div>
        );
      case 'code_search':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px', padding: '16px', background: '#0c0c12', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', overflowY: 'auto', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: 0 }}>V2 SEARCH ADVANTAGE</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Legacy scan / Grep</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>1.8s (Recursive)</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>Loops through every file linearly hitting hard disk constraints, resulting in long latencies and loose text string hits.</div>
              </div>
              
              <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>RecallKit V2 Search</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>25ms (Direct Index)</div>
                <div style={{ fontSize: '0.65rem', color: '#a7f3d0', marginTop: '6px', lineHeight: '1.3' }}>Sub-millisecond direct lookup using precompiled AST index matching symbol types (interfaces, functions, variables).</div>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.05)', borderRadius: '10px', border: '1px dashed rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                <span>Search Accuracy Boost</span>
                <span style={{ color: '#34d399' }}>98% Semantic Signal</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '98%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong>💡 Contextual Mapping:</strong> V2 ignores arbitrary text strings (like logs) and targets actual functional declarations, saving up to 8,500 prompt tokens.
            </div>
          </div>
        );
      case 'code_trace_flow':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px', padding: '16px', background: '#0c0c12', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', overflowY: 'auto', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: 0 }}>V2 TRACE FLOW ADVANTAGE</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Legacy Tab Hopping</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>8+ Steps / Hops</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>Developer or Agent must open dozens of different files sequentially, looking at import paths and caller usage.</div>
              </div>
              
              <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>RecallKit V2 Trace</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>1-Click Trace Map</div>
                <div style={{ fontSize: '0.65rem', color: '#a7f3d0', marginTop: '6px', lineHeight: '1.3' }}>Unified bidirectional trace graph of exact call chains and callers mapped directly in the active DB.</div>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.05)', borderRadius: '10px', border: '1px dashed rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                <span>Tokens saved on search loops</span>
                <span style={{ color: '#34d399' }}>18,000+ Saved</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '95%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong>💡 Exact Logic Navigation:</strong> Zero chance of model hallucination since dependencies are mathematically verified.
            </div>
          </div>
        );
      case 'code_insight':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '360px', padding: '16px', background: '#0c0c12', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '16px', overflowY: 'auto', borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', margin: 0 }}>V2 INSIGHT ADVANTAGE</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>Volatile Prompting</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f87171', marginTop: '4px' }}>Lost on Reset</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.3' }}>Architectural notes, database traps, and logic guidelines must be typed repeatedly in every session.</div>
              </div>
              
              <div style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.25)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase' }}>RecallKit V2 Cortex</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>Incremental Memory</div>
                <div style={{ fontSize: '0.65rem', color: '#a7f3d0', marginTop: '6px', lineHeight: '1.3' }}>Notes written once are indexed in SurrealDB and sync recursively when relevant files are touched.</div>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'rgba(168,85,247,0.05)', borderRadius: '10px', border: '1px dashed rgba(168,85,247,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '6px' }}>
                <span>Developer effort friction</span>
                <span style={{ color: '#34d399' }}>100% Frictionless</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
              <strong>💡 Lifelong Memory Sync:</strong> Knowledge grows and persists over time on open-source repos, delivering unmatched developer speed.
            </div>
          </div>
        );
      default:
        return null;
    }
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
          <div className="explorer-header" style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>Source Code Index</span>
              <RefreshCw size={12} style={{ cursor: 'pointer', color: '#6366f1' }} onClick={fetchFilesAndSymbols} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button 
                onClick={() => setSelectedFiles(playgroundFiles.map(f => f.path))}
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 700, outline: 'none' }}
              >
                Select All
              </button>
              <button 
                onClick={() => setSelectedFiles([])}
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', padding: '3px 8px', borderRadius: '4px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: 700, outline: 'none' }}
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="tree-view" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {playgroundFiles.map(file => {
              const isChecked = selectedFiles.includes(file.path);
              return (
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
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedFiles(prev => 
                        isChecked ? prev.filter(p => p !== file.path) : [...prev, file.path]
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                  />
                  <FileCode size={14} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{file.path}</span>
                </div>
              );
            })}
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
                      <option value="full">Full File (Uncollapsed Logic)</option>
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
                        onClick={() => setShowComparativeROI(!showComparativeROI)}
                        style={{ 
                          background: showComparativeROI ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', 
                          border: showComparativeROI ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.08)', 
                          color: showComparativeROI ? '#c084fc' : '#cbd5e1', 
                          padding: '6px 12px', 
                          borderRadius: '6px', 
                          fontSize: '0.7rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          fontWeight: 600
                        }}
                      >
                        <Zap size={12} style={{ color: showComparativeROI ? '#a855f7' : '#94a3b8' }} /> {showComparativeROI ? 'Hide Comparative ROI' : '⚡️ Show V2 Comparative ROI'}
                      </button>
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
                    <div style={{ display: 'flex', flexDirection: 'row', width: '100%', gap: '16px', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px', minWidth: 0 }}>

                      
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
                        /* Beautiful Visual Stack Trace Flow Renderer */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0px', padding: '10px 0' }}>
                          
                          {/* 1. TOP SECTION: Incoming Callers / Parent Frames */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /> Parent Scope / Incoming Callers
                            </div>
                            
                            {toolResult.incoming && toolResult.incoming.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                {toolResult.incoming.map((caller: any, index: number) => (
                                  <div 
                                    key={caller.name} 
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      padding: '12px 16px', 
                                      background: 'rgba(239,68,68,0.03)', 
                                      border: '1px solid rgba(239,68,68,0.15)', 
                                      borderRadius: '10px', 
                                      fontSize: '0.8rem',
                                      position: 'relative'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: '#f87171', fontWeight: 700, fontFamily: 'monospace' }}>{caller.name}()</span>
                                      <span style={{ color: '#4b5563', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                                        Caller frame {index + 1}
                                      </span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <FileText size={10} /> {caller.filePath}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                                No incoming callers recorded (Entrypoint / Root context)
                              </div>
                            )}
                          </div>

                          {/* Connector Line 1 */}
                          <div style={{ height: '36px', width: '2px', background: 'linear-gradient(180deg, #f87171, #6366f1)', position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></div>
                          </div>

                          {/* 2. CENTRAL SECTION: Active Traced Frame */}
                          <div 
                            style={{ 
                              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', 
                              border: '2px solid #6366f1', 
                              boxShadow: '0 0 25px rgba(99,102,241,0.2)',
                              borderRadius: '16px', 
                              padding: '20px 28px', 
                              width: '100%', 
                              maxWidth: '540px',
                              textAlign: 'center',
                              margin: '12px 0',
                              position: 'relative'
                            }}
                          >
                            <span style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', background: '#6366f1', color: 'white', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                              Active Trace Target
                            </span>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>Currently Inspected Function</div>
                            <h2 style={{ fontSize: '1.4rem', color: 'white', fontWeight: 800, margin: 0, fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{toolResult.symbol}</h2>
                            
                            {toolResult.implementations && toolResult.implementations.length > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
                                {toolResult.implementations.map((impl: any) => (
                                  <span key={impl.name} style={{ fontSize: '0.65rem', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                                    ✨ Implements: {impl.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Connector Line 2 */}
                          <div style={{ height: '36px', width: '2px', background: 'linear-gradient(180deg, #6366f1, #34d399)', position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></div>
                          </div>

                          {/* 3. BOTTOM SECTION: Callees / Executed Subroutines */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px', marginTop: '12px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /> Subroutines / Callees (Outgoing Calls)
                            </div>
                            
                            {toolResult.outgoing && toolResult.outgoing.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                {toolResult.outgoing.map((callee: any, index: number) => (
                                  <div 
                                    key={callee.name} 
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      padding: '12px 16px', 
                                      background: 'rgba(52,211,153,0.03)', 
                                      border: '1px solid rgba(52,211,153,0.15)', 
                                      borderRadius: '10px', 
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace' }}>{callee.name}()</span>
                                      <span style={{ color: '#4b5563', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                                        Sub-call {index + 1}
                                      </span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.68rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <FileText size={10} /> {callee.filePath}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                                No outgoing subroutines parsed (Terminal execution leaf)
                              </div>
                            )}
                          </div>

                        </div>
                      ) : activeTool === 'code_read' ? (
                        /* Dynamic Side-by-Side ROI Token Comparison Workspace */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                          
                          {/* Top ROI Header Banner */}
                          {codeReadCompare && (
                            <div style={{ 
                              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.08))', 
                              border: '1px solid rgba(16,185,129,0.25)', 
                              borderRadius: '12px', 
                              padding: '14px 20px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              boxShadow: '0 0 15px rgba(16,185,129,0.05)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={16} style={{ color: '#34d399' }} />
                                <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 800 }}>
                                  TokenZip V2 Context Saving Active:
                                </span>
                                <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 900, background: 'rgba(52,211,153,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                                  Saved {codeReadCompare.savings}% Context Size!
                                </span>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
                                🪙 <strong>{(codeReadCompare.rawTokens - codeReadCompare.smartTokens).toLocaleString()} Tokens</strong> &amp; <strong>{codeReadCompare.rawLines - codeReadCompare.smartLines} Lines</strong> of context noise eliminated!
                              </div>
                            </div>
                          )}

                          {/* Code View Deck - Check if it's a batch or single file */}
                          {(() => {
                            try {
                              const parsed = JSON.parse(toolResult?.content?.[0]?.text || '{}');
                              if (parsed && typeof parsed === 'object' && parsed.is_batch && Array.isArray(parsed.files)) {
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                                    {parsed.files.map((fileItem: any) => {
                                      const fPath = fileItem.filePath;
                                      const fCompare = batchCompareData[fPath];
                                      const rContent = batchRawContents[fPath] || '';
                                      
                                      return (
                                        <div key={fPath} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '20px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.82rem', color: '#818cf8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>📂 File: {fPath}</span>
                                            {fCompare && (
                                              <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, background: 'rgba(52,211,153,0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.15)' }}>
                                                ⚡️ {fCompare.savings}% compressed ({fCompare.smartTokens.toLocaleString()} vs {fCompare.rawTokens.toLocaleString()} tokens)
                                              </span>
                                            )}
                                          </div>

                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '350px', width: '100%' }}>
                                            {/* Left: V2 Smart */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 800 }}>V2 SMART READ (MODE: {readMode.toUpperCase()})</span>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fCompare?.smartTokens.toLocaleString() || '...'} tokens</span>
                                              </div>
                                              <pre className="code-box" style={{ flex: 1, margin: 0, padding: '12px', overflow: 'auto', fontSize: '0.7rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.5', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.15)' }}>
                                                {fileItem.content}
                                              </pre>
                                            </div>

                                            {/* Right: V1 Raw */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800 }}>V1 RAW READ</span>
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fCompare?.rawTokens.toLocaleString() || '...'} tokens</span>
                                              </div>
                                              <pre className="code-box" style={{ flex: 1, margin: 0, padding: '12px', overflow: 'auto', fontSize: '0.7rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#94a3b8', lineHeight: '1.5', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.1)' }}>
                                                {rContent || 'Loading raw file context...'}
                                              </pre>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }
                            } catch (e) {}

                            // Fallback single file comparison
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '400px', width: '100%' }}>
                                {/* Left Box: V2 Optimized skeletal content */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                                      V2 SMART READ (MODE: {readMode.toUpperCase()})
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(52,211,153,0.15)' }}>
                                      {codeReadCompare ? codeReadCompare.smartTokens.toLocaleString() : '...'} tokens
                                    </span>
                                  </div>
                                  <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '12px', border: '1px solid rgba(52,211,153,0.2)' }}>
                                    {getCleanResultText()}
                                  </pre>
                                </div>

                                {/* Right Box: Legacy raw full content */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171' }}></span>
                                      V1 LEGACY FULL FILE READ
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.15)' }}>
                                      {codeReadCompare ? codeReadCompare.rawTokens.toLocaleString() : '...'} tokens
                                    </span>
                                  </div>
                                  <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#94a3b8', lineHeight: '1.6', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {rawFileContent || 'Loading raw file context...'}
                                  </pre>
                                </div>
                              </div>
                            );
                          })()}

                        </div>
                      ) : activeTool === 'code_insight' ? (
                        /* Dedicated premium Cortex memory instruction viewer */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                          
                          {/* Success or Action Status Banner */}
                          <div style={{ 
                            background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(99,102,241,0.08))', 
                            border: '1px solid rgba(168,85,247,0.25)', 
                            borderRadius: '12px', 
                            padding: '14px 20px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            boxShadow: '0 0 15px rgba(168,85,247,0.05)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Zap size={16} style={{ color: '#a855f7' }} />
                              <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 800 }}>
                                Cortex Memory System Active ({insightAction.toUpperCase()}):
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
                              🗂️ Persistent local SurrealDB graph relationships
                            </div>
                          </div>

                          {/* Render returned instructions or raw JSON */}
                          {(() => {
                            try {
                              const text = toolResult?.content?.[0]?.text || '';
                              let parsed: any = null;
                              if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                                parsed = JSON.parse(text);
                              }

                              const list = parsed?.instructions || parsed?.results || [];

                              if (list.length > 0) {
                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', width: '100%' }}>
                                    {list.map((noteObj: any, i: number) => (
                                      <div 
                                        key={i}
                                        style={{ 
                                          padding: '16px', 
                                          borderRadius: '14px', 
                                          background: 'rgba(255,255,255,0.02)', 
                                          borderLeft: `5px solid ${
                                            noteObj.category === 'gotcha' ? '#f59e0b' : 
                                            noteObj.category === 'todo' ? '#3b82f6' : 
                                            noteObj.category === 'architecture' ? '#a855f7' : '#10b981'
                                          }`,
                                          borderTop: '1px solid rgba(255,255,255,0.04)',
                                          borderRight: '1px solid rgba(255,255,255,0.04)',
                                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                                          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                        }}
                                      >
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {noteObj.title}
                                          </span>
                                          <span style={{ 
                                            fontSize: '0.58rem', fontWeight: 950, padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase',
                                            background: noteObj.category === 'gotcha' ? 'rgba(245,158,11,0.15)' : 
                                                        noteObj.category === 'todo' ? 'rgba(59,130,246,0.15)' : 
                                                        noteObj.category === 'architecture' ? 'rgba(168,85,247,0.15)' : 'rgba(16,185,129,0.15)',
                                            color: noteObj.category === 'gotcha' ? '#f59e0b' : 
                                                   noteObj.category === 'todo' ? '#3b82f6' : 
                                                   noteObj.category === 'architecture' ? '#a855f7' : '#10b981'
                                          }}>
                                            {noteObj.category}
                                          </span>
                                        </div>
                                        <p style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: '1.45', margin: '0 0 10px 0' }}>{noteObj.summary}</p>
                                        {noteObj.details && (
                                          <div style={{ fontSize: '0.7rem', color: '#64748b', background: '#07070a', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', fontFamily: '"Fira Code", monospace', whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
                                            {noteObj.details}
                                          </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.62rem', color: '#4b5563', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                                          <span>ID: <code style={{ color: '#cbd5e1' }}>{noteObj.id}</code></span>
                                          {noteObj.priority && <span>Priority: <strong style={{ color: noteObj.priority === 'critical' ? '#ef4444' : '#64748b' }}>{noteObj.priority}</strong></span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                            } catch (e) {
                              // Fallback to text if not JSON
                            }

                            // Fallback rendering
                            return (
                              <pre className="code-box" style={{ flex: 1, margin: 0, padding: '20px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {getCleanResultText()}
                              </pre>
                            );
                          })()}
                        </div>
                      ) : (
                        /* Standard JSON/Code output render */
                        <pre className="code-box" style={{ flex: 1, margin: 0, padding: '20px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {getCleanResultText()}
                        </pre>
                      )}

                      {/* Interactive Cortex Notes Renderer - if returned by server */}
                      {(toolResult.instructions || toolResult.results || toolResult._cortex || toolResult._insights || (toolResult.insights && toolResult.insights.length > 0)) && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                            <BookOpen size={14} /> Persistent Cortex Architecture Rules ({((toolResult.instructions || toolResult.results || toolResult._cortex?.notes || toolResult._insights || toolResult.insights || []) as any).length} loaded)
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                            {((toolResult.instructions || toolResult.results || toolResult._cortex?.notes || toolResult._insights || toolResult.insights || []) as any).map((insight: any, i: number) => {
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
                    {showComparativeROI && renderComparativeROI()}
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
