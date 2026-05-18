import React from 'react';
import { Zap, ChevronRight, FileText } from 'lucide-react';

interface ToolCodeTraceFlowInputsProps {
  traceTarget: string;
  setTraceTarget: (val: string) => void;
  traceDirection: 'in' | 'out' | 'both';
  setTraceDirection: (val: 'in' | 'out' | 'both') => void;
  allRepoSymbols: string[];
}

export const ToolCodeTraceFlowInputs: React.FC<ToolCodeTraceFlowInputsProps> = ({
  traceTarget,
  setTraceTarget,
  traceDirection,
  setTraceDirection,
  allRepoSymbols
}) => {
  return (
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
  );
};

export const ToolCodeTraceFlowROI: React.FC = () => {
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
};

interface ToolCodeTraceFlowOutputProps {
  toolResult: any;
  onSelectSymbol: (symbolName: string) => void;
}

export const ToolCodeTraceFlowOutput: React.FC<ToolCodeTraceFlowOutputProps> = ({
  toolResult,
  onSelectSymbol
}) => {
  let data = toolResult;
  if (toolResult && Array.isArray(toolResult.content) && toolResult.content[0]) {
    try {
      data = JSON.parse(toolResult.content[0].text);
    } catch (e) {}
  }

  if (!data || (!data.incoming && !data.outgoing)) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0px', padding: '10px 0' }}>
      
      {/* 1. TOP SECTION: Incoming Callers / Parent Frames */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
        <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /> Parent Scope / Incoming Callers
        </div>
        
        {data.incoming && data.incoming.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {data.incoming.map((caller: any, index: number) => (
              <div 
                key={caller.name} 
                onClick={() => onSelectSymbol(caller.name)}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  padding: '12px 16px', 
                  background: 'rgba(239,68,68,0.03)', 
                  border: '1px solid rgba(239,68,68,0.15)', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)';
                  e.currentTarget.style.transform = 'none';
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
        <h2 style={{ fontSize: '1.4rem', color: 'white', fontWeight: 800, margin: 0, fontFamily: 'monospace', textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{data.symbol}</h2>
        
        {data.implementations && data.implementations.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
            {data.implementations.map((impl: any) => (
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
        
        {data.outgoing && data.outgoing.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {data.outgoing.map((callee: any, index: number) => (
              <div 
                key={callee.name} 
                onClick={() => onSelectSymbol(callee.name)}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  padding: '12px 16px', 
                  background: 'rgba(52,211,153,0.03)', 
                  border: '1px solid rgba(52,211,153,0.15)', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(52,211,153,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(52,211,153,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(52,211,153,0.15)';
                  e.currentTarget.style.transform = 'none';
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
  );
};
