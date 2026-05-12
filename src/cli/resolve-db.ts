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
  const repoPath = path.resolve(cwd);
  
  // Case A: Are we inside a .tokenzip directory?
  if (repoPath.endsWith('.tokenzip') || repoPath.includes('/.tokenzip/')) {
    const rootOfTokenzip = repoPath.split('/.tokenzip')[0] + '/.tokenzip';
    const db = path.join(rootOfTokenzip, 'db');
    return { dbPath: db, repoPath: path.dirname(rootOfTokenzip) };
  }

  // Standard case: .tokenzip is a sibling or child of the code
  const dbPath = path.join(repoPath, '.tokenzip', 'db');
  return { dbPath, repoPath };
}
