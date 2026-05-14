import path from 'path';

/**
 * Normalizes a path for the TokenZip index.
 * - Removes leading ./
 * - Ensures forward slashes
 * - Resolves .. if possible (within repo)
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return filePath;
  
  let normalized = filePath.trim();
  
  // Remove leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  } else if (normalized.startsWith('.' + path.sep)) {
    normalized = normalized.substring(2);
  }
  
  // Convert backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');
  
  // Remove trailing slash
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  
  return normalized;
}
