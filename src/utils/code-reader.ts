import fs from 'fs';
import path from 'path';

export interface CodeRange {
  startLine: number;
  endLine: number;
}

/**
 * Reads a specific range of lines from a file.
 * Lines are 1-indexed.
 */
export function readCodeRange(filePath: string, range: CodeRange): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // startLine and endLine are 1-indexed
  const start = Math.max(0, range.startLine - 1);
  const end = Math.min(lines.length, range.endLine);
  
  return lines.slice(start, end).join('\n');
}
