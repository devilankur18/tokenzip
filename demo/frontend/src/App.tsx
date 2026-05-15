import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Search, 
  FileCode, 
  Github, 
  ChevronRight, 
  ArrowRight,
  Database,
  Layers,
  Cpu
} from 'lucide-react';
import './index.css';

const PRESETS = [
  { name: 'OpenClaw', url: 'https://github.com/openclaw/openclaw' },
  { name: 'Express.js', url: 'https://github.com/expressjs/express' },
  { name: 'React', url: 'https://github.com/facebook/react' }
];

export default function App() {
  const [githubUrl, setGithubUrl] = useState(PRESETS[0].url);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexedRepo, setIndexedRepo] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rawOutput, setRawOutput] = useState('');
  const [smartOutput, setSmartOutput] = useState('');
  const [stats, setStats] = useState({ raw: 0, smart: 0, savings: 0 });

  const handleIndex = async () => {
    setIsIndexing(true);
    try {
      const res = await fetch('http://localhost:3001/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl })
      });
      const data = await res.json();
      setIndexedRepo(data.repoName);
      
      // Load file tree after indexing
      const treeRes = await fetch(`http://localhost:3001/api/tools/${data.repoName}/get_file_tree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const treeData = await treeRes.json();
      setFileTree(treeData.content?.[0]?.text ? JSON.parse(treeData.content[0].text) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleFileSelect = async (path: string) => {
    setSelectedFile(path);
    try {
      // Get Raw Output
      const rawRes = await fetch(`http://localhost:3001/api/tools/${indexedRepo}/file_read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const rawData = await rawRes.json();
      const rawText = rawData.content[0].text;
      setRawOutput(rawText);

      // Get Smart Output
      const smartRes = await fetch(`http://localhost:3001/api/tools/${indexedRepo}/smart_file_read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const smartData = await smartRes.json();
      const smartText = smartData.content[0].text;
      setSmartOutput(smartText);

      // Calculate Stats (Rough estimate)
      const rawTokens = rawText.split(/\s+/).length * 1.3;
      const smartTokens = smartText.split(/\s+/).length * 1.3;
      const savings = Math.round((1 - smartTokens / rawTokens) * 100);
      
      setStats({
        raw: Math.round(rawTokens),
        smart: Math.round(smartTokens),
        savings: Math.max(0, savings)
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/50">
            <Zap size={32} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="text-3xl font-bold glow-text">TokenZip <span className="text-indigo-400">Playground</span></h1>
            <p className="text-slate-400">Semantic Code Compression for AI Agents</p>
          </div>
        </div>

        <div className="flex gap-4 items-center glass-panel p-2 pl-4">
          <Github size={20} className="text-slate-400" />
          <input 
            type="text" 
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            className="bg-transparent border-none outline-none text-slate-200 w-64"
            placeholder="GitHub Repo URL..."
          />
          <button 
            onClick={handleIndex}
            disabled={isIndexing}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {isIndexing ? 'Indexing...' : 'Launch Demo'}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8">
        {/* Sidebar: File Tree */}
        <div className="col-span-3 glass-panel p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-4 flex items-center gap-2">
            <Layers size={14} /> Repository Explorer
          </h3>
          <div className="space-y-1">
            {fileTree.length > 0 ? fileTree.map((file, i) => (
              <button 
                key={i}
                onClick={() => handleFileSelect(file.path)}
                className={`w-full text-left px-3 py-2 rounded-md transition-all text-sm flex items-center gap-2 ${selectedFile === file.path ? 'bg-indigo-600/30 text-indigo-300' : 'hover:bg-white/5 text-slate-400'}`}
              >
                <FileCode size={16} />
                <span className="truncate">{file.path.split('/').pop()}</span>
              </button>
            )) : (
              <p className="text-slate-500 text-sm italic">Index a repository to start exploring...</p>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="col-span-9 space-y-6">
          {/* Comparison Panes */}
          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-320px)]">
            {/* Raw View */}
            <div className="code-window glass-panel overflow-hidden">
              <div className="code-header">
                <span className="text-slate-400 text-xs font-bold flex items-center gap-2">
                  <Database size={14} /> file_read (Standard)
                </span>
                {stats.raw > 0 && <span className="token-badge">{stats.raw} tokens</span>}
              </div>
              <div className="code-content text-slate-500">
                {rawOutput || (
                  <div className="h-full flex items-center justify-center opacity-20">
                    <Github size={64} />
                  </div>
                )}
              </div>
            </div>

            {/* Smart View */}
            <div className="code-window gradient-border overflow-hidden">
              <div className="code-header bg-indigo-600/10">
                <span className="text-indigo-300 text-xs font-bold flex items-center gap-2">
                  <Cpu size={14} /> smart_file_read (TokenZip)
                </span>
                {stats.smart > 0 && <span className="token-badge bg-emerald-600">{stats.smart} tokens</span>}
              </div>
              <div className="code-content text-slate-300">
                {smartOutput || (
                  <div className="h-full flex items-center justify-center opacity-20">
                    <Zap size={64} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="glass-panel p-6 flex items-center gap-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex-1">
              <div className="flex justify-between items-end mb-2">
                <span className="text-slate-400 text-sm font-medium">Context Optimization ROI</span>
                <span className="text-emerald-400 font-bold text-2xl">{stats.savings}% SAVED</span>
              </div>
              <div className="savings-meter">
                <div className="savings-bar">
                  <div className="savings-fill" style={{ width: `${stats.savings}%` }}></div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-8 border-l border-white/10 pl-12">
              <div>
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Standard Cost</p>
                <p className="text-slate-300 font-mono">{(stats.raw * 0.00001).toFixed(4)} USD</p>
              </div>
              <ArrowRight size={20} className="text-slate-600 self-center" />
              <div>
                <p className="text-indigo-400 text-xs uppercase font-bold tracking-wider mb-1">TokenZip Cost</p>
                <p className="text-emerald-400 font-bold font-mono">{(stats.smart * 0.00001).toFixed(4)} USD</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative Background */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px]"></div>
      </div>
    </div>
  );
}
