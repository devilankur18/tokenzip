import path from 'path';
import fs from 'fs';

/**
 * Resolve the TokenZip database path from the given working directory.
 *
 * Strategy: walk up from cwd looking for a `.tokenzip/db` directory.
 * If the cwd itself IS a `.tokenzip` dir (contains `db/`), use it directly.
 * Otherwise look for `.tokenzip/db` in cwd.
 *
 * Returns { dbPath, repoPath } where repoPath is where the code lives.
 */
export function resolveDbPath(cwd: string): { dbPath: string; repoPath: string } {
  const absolutePath = path.resolve(cwd);
  
  // Case A: Are we inside a .tokenzip directory?
  if (absolutePath.endsWith('.tokenzip') || absolutePath.includes('/.tokenzip/')) {
    const rootOfTokenzip = absolutePath.split('/.tokenzip')[0] + '/.tokenzip';
    const db = path.join(rootOfTokenzip, 'db');
    // If the tool is installed AS .tokenzip in a project, repoPath is .tokenzip
    // This allows indexing JUST the tool source if needed.
    return { dbPath: db, repoPath: rootOfTokenzip };
  }

  // Standard case: .tokenzip is a child of the code we want to index
  const dbPath = path.join(absolutePath, '.tokenzip', 'db');
  return { dbPath, repoPath: absolutePath };
}
