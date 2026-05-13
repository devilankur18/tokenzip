import fs from 'fs';

export class FileLineCache {
  private cache = new Map<string, string[]>();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  getLines(absPath: string): string[] {
    if (this.cache.has(absPath)) {
      // Move to end of map (most recently used)
      const lines = this.cache.get(absPath)!;
      this.cache.delete(absPath);
      this.cache.set(absPath, lines);
      return lines;
    }

    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }

    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n');

    if (this.cache.size >= this.maxSize) {
      // Delete least recently used (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(absPath, lines);
    return lines;
  }

  getRange(absPath: string, startLine: number, endLine: number): string[] {
    const lines = this.getLines(absPath);
    // startLine and endLine are 1-indexed
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end);
  }
}

export const fileCache = new FileLineCache();
