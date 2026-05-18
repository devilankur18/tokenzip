import React, { useState, useMemo } from 'react';

export const parseAsciiTree = (text: string) => {
  const lines = text.split('\n');
  const treeNodes: any[] = [];
  const activeFoldersAtDepth: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Matches visual branches like "├── ", "└── ", "│   ", "    "
    const prefixMatch = line.match(/^([│\s├└───]*)/);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    const depth = Math.round(prefix.length / 4);

    const content = line.substring(prefix.length).trim();
    if (!content) continue;

    // Match emoji icon and node label
    const match = content.match(/^([^\s\w]+)\s+(.+)$/);
    const icon = match ? match[1] : '';
    let name = match ? match[2] : content;

    // Clean up symbol brackets like "[📄 index.ts, 𝑓 run]"
    let exports: string[] = [];
    if (name.includes('[') && name.endsWith(']')) {
      const start = name.indexOf('[');
      const brackets = name.substring(start + 1, name.length - 1);
      name = name.substring(0, start).trim();
      exports = brackets.split(',').map(s => s.trim());
    }

    const isFolder = icon === '📂' || icon === '📁' || icon === '🏠' || icon === '📦';
    
    // Reconstruct approximate paths
    activeFoldersAtDepth[depth] = name;
    const parentPath = activeFoldersAtDepth.slice(0, depth).join('/');
    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    treeNodes.push({
      depth,
      icon,
      name,
      fullPath,
      isFolder,
      exports,
      originalLine: line
    });
  }

  return treeNodes;
};

interface InteractiveAsciiTreeProps {
  text: string;
  onFileClick: (path: string) => void;
  onExportClick?: (filePath: string, exportName: string, type: 'file' | 'symbol') => void;
}

const InteractiveAsciiTree: React.FC<InteractiveAsciiTreeProps> = ({ text, onFileClick, onExportClick }) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  
  const nodes = useMemo(() => {
    try {
      return parseAsciiTree(text);
    } catch (e) {
      return [];
    }
  }, [text]);

  if (nodes.length === 0) {
    return (
      <pre className="code-box" style={{ flex: 1, margin: 0, padding: '20px', overflow: 'auto', fontSize: '0.75rem', fontFamily: '"Fira Code", monospace', background: '#050507', color: '#cbd5e1', lineHeight: '1.6', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
        {text}
      </pre>
    );
  }

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const visibleNodes = [];
  let currentHiddenPrefixDepth = 999;

  for (const node of nodes) {
    if (node.depth > currentHiddenPrefixDepth) {
      continue;
    } else {
      currentHiddenPrefixDepth = 999;
    }

    visibleNodes.push(node);

    if (node.isFolder && collapsedPaths[node.fullPath]) {
      currentHiddenPrefixDepth = node.depth;
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      padding: '20px',
      borderRadius: '16px',
      background: 'rgba(9, 9, 14, 0.65)',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxHeight: '600px',
      overflowY: 'auto',
      fontFamily: '"Fira Code", monospace',
      fontSize: '0.76rem',
      lineHeight: '1.6',
      width: '100%'
    }}>
      {visibleNodes.map((node, index) => {
        const isCollapsed = collapsedPaths[node.fullPath];
        return (
          <div 
            key={index}
            style={{
              paddingLeft: `${node.depth * 18}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '5px',
              paddingBottom: '5px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              userSelect: 'none',
              background: node.isFolder ? 'rgba(255,255,255,0.015)' : 'transparent',
              border: node.isFolder ? '1px solid rgba(255,255,255,0.01)' : 'none'
            }}
            onClick={() => {
              if (node.isFolder) {
                toggleCollapse(node.fullPath);
              } else {
                onFileClick(node.fullPath);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
              e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = node.isFolder ? 'rgba(255,255,255,0.015)' : 'transparent';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span style={{ color: node.isFolder ? '#818cf8' : '#64748b', fontSize: '0.65rem', width: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {node.isFolder ? (isCollapsed ? '▶' : '▼') : '•'}
              </span>
              <span style={{ fontSize: '0.95rem' }}>{node.icon}</span>
              <span style={{ 
                fontWeight: node.isFolder ? 800 : 500, 
                color: node.isFolder ? '#cbd5e1' : '#f8fafc',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}>
                {node.name}
              </span>
            </div>
            
            {node.exports && node.exports.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', overflow: 'hidden', marginLeft: '12px', marginRight: '6px' }}>
                {node.exports.slice(0, 3).map((exp: any, i: number) => {
                  const isFileExport = exp.includes('📄') || exp.endsWith('.ts') || exp.endsWith('.tsx') || exp.endsWith('.js') || exp.endsWith('.jsx') || exp.endsWith('.py') || exp.endsWith('.go') || exp.endsWith('.rs');
                  const cleanLabel = exp.replace(/^[^\w]+/, '').trim();
                  
                  return (
                    <span 
                      key={i} 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onExportClick) {
                          // Find containing file
                          let containingFile = node.fullPath;
                          const fileExport = node.exports.find((ex: string) => ex.includes('📄') || ex.endsWith('.ts') || ex.endsWith('.tsx') || ex.endsWith('.js') || ex.endsWith('.jsx') || ex.endsWith('.py') || ex.endsWith('.go') || ex.endsWith('.rs'));
                          if (fileExport) {
                            const cleanFile = fileExport.replace(/^[^\w]+/, '').trim();
                            const nodeParent = node.fullPath.includes('/') ? node.fullPath.substring(0, node.fullPath.lastIndexOf('/')) : '';
                            containingFile = nodeParent ? `${nodeParent}/${cleanFile}` : cleanFile;
                          }
                          
                          if (isFileExport) {
                            onExportClick(containingFile, cleanLabel, 'file');
                          } else {
                            onExportClick(containingFile, cleanLabel, 'symbol');
                          }
                        }
                      }}
                      style={{ 
                        fontSize: '0.58rem', 
                        background: isFileExport ? 'rgba(52,211,153,0.12)' : 'rgba(99,102,241,0.12)', 
                        border: isFileExport ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(99,102,241,0.2)',
                        color: isFileExport ? '#a7f3d0' : '#a5b4fc', 
                        padding: '2px 6px', 
                        borderRadius: '5px',
                        whiteSpace: 'nowrap',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {exp}
                    </span>
                  );
                })}
                {node.exports.length > 3 && (
                  <span style={{ fontSize: '0.58rem', color: '#64748b', alignSelf: 'center' }}>
                    +{node.exports.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default InteractiveAsciiTree;
