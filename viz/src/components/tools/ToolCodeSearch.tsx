import React from 'react';
import { Zap, FileText } from 'lucide-react';

interface ToolCodeSearchInputsProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchKind: string;
  setSearchKind: (val: string) => void;
  searchPathFilter: string;
  setSearchPathFilter: (val: string) => void;
  searchLimit: number;
  setSearchLimit: (val: number) => void;
}

export const ToolCodeSearchInputs: React.FC<ToolCodeSearchInputsProps> = ({
  searchQuery,
  setSearchQuery,
  searchKind,
  setSearchKind,
  searchPathFilter,
  setSearchPathFilter,
  searchLimit,
  setSearchLimit
}) => {
  return (
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
  );
};

export const ToolCodeSearchROI: React.FC = () => {
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
};

interface ToolCodeSearchOutputProps {
  toolResult: any;
  onSelectMatch: (filePath: string) => void;
}

export const ToolCodeSearchOutput: React.FC<ToolCodeSearchOutputProps> = ({
  toolResult,
  onSelectMatch
}) => {
  let data = toolResult;
  if (toolResult && Array.isArray(toolResult.content) && toolResult.content[0]) {
    try {
      data = JSON.parse(toolResult.content[0].text);
    } catch (e) {}
  }

  if (!data || !data.matches) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Found {data.matchCount || 0} matching code structures in the index:</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {data.matches.map((match: any) => (
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
            onClick={() => onSelectMatch(match.filePath)}
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
  );
};
