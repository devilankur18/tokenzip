import React from 'react';
import { Zap } from 'lucide-react';

interface ToolLegacyCompareProps {
  selectedFile: string | null;
  isComparing: boolean;
  comparisonData: {
    raw: string;
    smart: string;
    rawTokens: number;
    smartTokens: number;
    savings: number;
  } | null;
}

export const ToolLegacyCompare: React.FC<ToolLegacyCompareProps> = ({
  selectedFile,
  isComparing,
  comparisonData
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Top Metric Header Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        
        {/* Left Header info */}
        <div style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '0.62rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>Legacy V1 Context Volume</h4>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>
              {isComparing ? 'Scanning...' : comparisonData ? `${comparisonData.rawTokens.toLocaleString()} Tokens` : 'N/A'}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Total file text characters: <strong>{comparisonData?.raw.length.toLocaleString() || 0}</strong>
          </span>
        </div>
        
        {/* Right Header info */}
        <div style={{ background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '0.62rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>RecallKit V2 Token Volume</h4>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>
              {isComparing ? 'Skeletizing...' : comparisonData ? `${comparisonData.smartTokens.toLocaleString()} Tokens` : 'N/A'}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>
            AST Signature Extractor
          </span>
        </div>
      </div>

      {/* Code comparison grids */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '400px', width: '100%' }}>
        {/* Left legacy raw box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, paddingLeft: '4px' }}>standard_file_read (V1 Raw Dump)</span>
          <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {isComparing ? 'Scanning full context...' : comparisonData ? comparisonData.raw : `// Select any file from explorer to trigger comparison (Current: ${selectedFile || 'None'})`}
          </pre>
        </div>
        {/* Right optimized skeleton box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, paddingLeft: '4px' }}>smart_file_read (V2 Token Optimized Projection)</span>
          <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)' }}>
            {isComparing ? 'Extracting syntax skeleton...' : comparisonData ? comparisonData.smart : `// Select any file from explorer to trigger comparison (Current: ${selectedFile || 'None'})`}
          </pre>
        </div>
      </div>

      {/* Token savings banner */}
      {comparisonData && !isComparing && (
        <div style={{ 
          background: 'linear-gradient(90deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))', 
          border: '1px solid rgba(99,102,241,0.2)', 
          borderRadius: '12px', 
          padding: '16px 20px', 
          display: 'flex', 
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'stretch'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={14} style={{ color: '#818cf8' }} /> Token Savings Advantage
            </span>
            <span style={{ fontSize: '0.9rem', color: '#34d399', fontWeight: 900 }}>
              {comparisonData.savings}% reduction in prompt overhead
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${comparisonData.savings}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '4px' }}></div>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginTop: '4px' }}>
            Eliminated <strong>{(comparisonData.rawTokens - comparisonData.smartTokens).toLocaleString()} useless prompt tokens</strong>! Ready to speed up reasoning loops.
          </div>
        </div>
      )}

    </div>
  );
};
export default ToolLegacyCompare;
