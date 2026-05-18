import React from 'react';
import { Zap, BookOpen } from 'lucide-react';

interface ToolCodeInsightInputsProps {
  insightAction: 'recall' | 'save' | 'search' | 'forget';
  setInsightAction: (val: 'recall' | 'save' | 'search' | 'forget') => void;
  insightTarget: string;
  setInsightTarget: (val: string) => void;
  insightQuery: string;
  setInsightQuery: (val: string) => void;
  insightId: string;
  setInsightId: (val: string) => void;
  insightNoteCategory: 'guideline' | 'architecture' | 'gotcha' | 'todo';
  setInsightNoteCategory: (val: 'guideline' | 'architecture' | 'gotcha' | 'todo') => void;
}

export const ToolCodeInsightInputs: React.FC<ToolCodeInsightInputsProps> = ({
  insightAction,
  setInsightAction,
  insightTarget,
  setInsightTarget,
  insightQuery,
  setInsightQuery,
  insightId,
  setInsightId,
  insightNoteCategory,
  setInsightNoteCategory
}) => {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Active Instruction Tool:</label>
        <select 
          value={insightAction} 
          onChange={(e) => setInsightAction(e.target.value as any)}
          style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
        >
          <option value="recall">recall_instruction (Recall Active Guidelines)</option>
          <option value="save">remember_instruction (Store Persistent Note)</option>
          <option value="search">search_instruction (Query Guidelines Registry)</option>
          <option value="forget">forget_instruction (Archive / Soft-Delete)</option>
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
  );
};

interface ToolCodeInsightSaveFormProps {
  insightNoteTitle: string;
  setInsightNoteTitle: (val: string) => void;
  insightNoteSummary: string;
  setInsightNoteSummary: (val: string) => void;
  insightNoteScope: 'file' | 'module' | 'codebase';
  setInsightNoteScope: (val: 'file' | 'module' | 'codebase') => void;
}

export const ToolCodeInsightSaveForm: React.FC<ToolCodeInsightSaveFormProps> = ({
  insightNoteTitle,
  setInsightNoteTitle,
  insightNoteSummary,
  setInsightNoteSummary,
  insightNoteScope,
  setInsightNoteScope
}) => {
  return (
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
  );
};

export const ToolCodeInsightROI: React.FC = () => {
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
};

interface ToolCodeInsightOutputProps {
  toolResult: any;
  getParsedInstructions: () => any[] | null;
  copyToClipboard: (text: string) => void;
}

export const ToolCodeInsightOutput: React.FC<ToolCodeInsightOutputProps> = ({
  toolResult,
  getParsedInstructions,
  copyToClipboard
}) => {
  const parsedNotes = getParsedInstructions() || (toolResult?._cortex?.notes || toolResult?._insights || toolResult?.insights);
  if (!parsedNotes || !Array.isArray(parsedNotes) || parsedNotes.length === 0) return null;

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', width: '100%' }}>
      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <BookOpen size={14} /> Persistent Cortex Architecture Rules ({parsedNotes.length} loaded)
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {parsedNotes.map((insight: any, i: number) => {
          const noteObj = typeof insight === 'string' ? { title: 'Architectural Note', summary: insight, category: 'guideline' } : insight;
          const isStale = noteObj.title?.includes('[⚠️ STALE]');
          const cleanTitle = noteObj.title?.replace(' [⚠️ STALE]', '') || 'Persistent Instruction';
          return (
            <div 
              key={i}
              style={{ 
                padding: '14px', 
                borderRadius: '12px', 
                background: isStale ? 'rgba(239,68,68,0.02)' : 'rgba(255,255,255,0.01)', 
                borderLeft: `4px solid ${
                  isStale ? '#ef4444' :
                  noteObj.category === 'gotcha' ? '#f59e0b' : 
                  noteObj.category === 'todo' ? '#3b82f6' : '#10b981'
                }`,
                borderTop: isStale ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(255,255,255,0.04)',
                borderRight: isStale ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(255,255,255,0.04)',
                borderBottom: isStale ? '1px solid rgba(239,68,68,0.1)' : '1px solid rgba(255,255,255,0.04)',
                position: 'relative'
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {cleanTitle}
                  {isStale && (
                    <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.25)', fontWeight: 800 }}>STALE</span>
                  )}
                </span>
                <span 
                  onClick={() => copyToClipboard(noteObj.id)}
                  style={{ fontSize: '0.62rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'monospace' }}
                  title="Click to copy ID"
                >
                  {noteObj.id || 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '8px' }}>
                {noteObj.summary}
              </div>
              {noteObj.details && (
                <pre style={{ margin: 0, padding: '8px', fontSize: '0.65rem', background: '#050507', color: '#94a3b8', borderRadius: '6px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'pre-wrap' }}>
                  {noteObj.details}
                </pre>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800, color: noteObj.category === 'gotcha' ? '#f59e0b' : noteObj.category === 'todo' ? '#3b82f6' : '#10b981', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                  {noteObj.category}
                </span>
                {noteObj.priority && (
                  <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800, color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                    {noteObj.priority}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
