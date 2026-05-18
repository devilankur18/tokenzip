import React from 'react';
import { Zap } from 'lucide-react';

interface ToolCodeSnapshotInputsProps {
  snapshotPath: string;
  setSnapshotPath: (val: string) => void;
  snapshotFormat: 'tree' | 'json';
  setSnapshotFormat: (val: 'tree' | 'json') => void;
  snapshotDepth: number;
  setSnapshotDepth: (val: number) => void;
}

export const ToolCodeSnapshotInputs: React.FC<ToolCodeSnapshotInputsProps> = ({
  snapshotPath,
  setSnapshotPath,
  snapshotFormat,
  setSnapshotFormat,
  snapshotDepth,
  setSnapshotDepth
}) => {
  return (
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
  );
};

export const ToolCodeSnapshotROI: React.FC = () => {
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
};
