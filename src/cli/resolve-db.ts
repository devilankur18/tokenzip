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
export function resolveDbPath(cwd: string = process.cwd()): { dbPath: string; repoPath: string } {
  let current = path.resolve(cwd || process.cwd());
  
  // Look for .tokenzip/db starting from current and going up
  while (current !== path.parse(current).root) {
    const potentialDb = path.join(current, '.tokenzip', 'db');
    if (fs.existsSync(potentialDb)) {
      return { dbPath: potentialDb, repoPath: current };
    }
    // Special case: we are ALREADY inside a .tokenzip directory that has a db sibling/child
    if (path.basename(current) === '.tokenzip' && fs.existsSync(path.join(current, 'db'))) {
       return { dbPath: path.join(current, 'db'), repoPath: current };
    }
    current = path.dirname(current);
  }

  // Default: current directory is repo root, and we'll create .tokenzip/db there
  const root = path.resolve(cwd || process.cwd());
  const dbPath = path.join(root, '.tokenzip', 'db');
  return { dbPath, repoPath: root };
}
