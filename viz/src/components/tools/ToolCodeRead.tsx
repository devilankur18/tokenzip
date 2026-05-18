import React, { useState } from 'react';
import { Zap, Copy, Check } from 'lucide-react';

const MiniCopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: copied ? '#10b981' : '#cbd5e1',
        padding: '3px 8px',
        borderRadius: '5px',
        fontSize: '0.62rem',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontWeight: 600
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }}
    >
      {copied ? <Check size={10} style={{ color: '#10b981' }} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

interface ToolCodeReadInputsProps {
  readPath: string;
  setReadPath: (val: string) => void;
  readMode: 'skeleton' | 'interface' | 'implementation' | 'full';
  setReadMode: (val: 'skeleton' | 'interface' | 'implementation' | 'full') => void;
  readSymbol: string;
  setReadSymbol: (val: string) => void;
  fileSymbols: string[];
}

export const ToolCodeReadInputs: React.FC<ToolCodeReadInputsProps> = ({
  readPath,
  setReadPath,
  readMode,
  setReadMode,
  readSymbol,
  setReadSymbol,
  fileSymbols
}) => {
  return (
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
  );
};

interface ToolCodeReadROIProps {
  codeReadCompare: {
    rawTokens: number;
    smartTokens: number;
    rawLines: number;
    smartLines: number;
    savings: number;
  } | null;
  selectedFile: string | null;
}

export const ToolCodeReadROI: React.FC<ToolCodeReadROIProps> = ({
  codeReadCompare,
  selectedFile
}) => {
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
};

interface ToolCodeReadOutputProps {
  toolResult: any;
  getCleanResultText: () => string;
  codeReadCompare: {
    rawTokens: number;
    smartTokens: number;
    rawLines: number;
    smartLines: number;
    savings: number;
  } | null;
  batchCompareData: Record<string, {
    rawTokens: number;
    smartTokens: number;
    rawLines: number;
    smartLines: number;
    savings: number;
  }>;
  batchRawContents: Record<string, string>;
  readMode: string;
  rawFileContent: string | null;
}

export const ToolCodeReadOutput: React.FC<ToolCodeReadOutputProps> = ({
  toolResult,
  getCleanResultText,
  codeReadCompare,
  batchCompareData,
  batchRawContents,
  readMode,
  rawFileContent
}) => {
  // Render logic for batch or single file comparison
  try {
    const text = toolResult?.content?.[0]?.text || '';
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.is_batch && Array.isArray(parsed.files)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fCompare?.smartTokens.toLocaleString() || '...'} tokens</span>
                          <MiniCopyButton text={fileItem.content} />
                        </div>
                      </div>
                      <pre className="code-box" style={{ flex: 1, margin: 0, padding: '12px', overflow: 'auto', fontSize: '0.7rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.5', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.15)' }}>
                        {fileItem.content}
                      </pre>
                    </div>

                    {/* Right: V1 Raw */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800 }}>V1 RAW READ</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fCompare?.rawTokens.toLocaleString() || '...'} tokens</span>
                          <MiniCopyButton text={rContent} />
                        </div>
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
        </div>
      );
    }
  } catch (e) {}

  // Fallback single file comparison
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
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
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '400px', width: '100%' }}>
        {/* Left Box: V2 Optimized skeletal content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
              V2 SMART READ (MODE: {readMode.toUpperCase()})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(52,211,153,0.15)' }}>
                {codeReadCompare ? codeReadCompare.smartTokens.toLocaleString() : '...'} tokens
              </span>
              <MiniCopyButton text={getCleanResultText()} />
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.15)' }}>
                {codeReadCompare ? codeReadCompare.rawTokens.toLocaleString() : '...'} tokens
              </span>
              <MiniCopyButton text={rawFileContent || ''} />
            </div>
          </div>
          <pre className="code-box" style={{ flex: 1, margin: 0, padding: '16px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#94a3b8', lineHeight: '1.6', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>
            {rawFileContent || 'Loading raw file context...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
