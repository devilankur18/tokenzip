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
  const resolved = path.resolve(cwd);

  // Case A: cwd has a `db/` subdirectory (we're inside .tokenzip or a similar container)
  const directDb = path.join(resolved, 'db');
  if (fs.existsSync(directDb) && fs.statSync(directDb).isDirectory()) {
    // repoPath = same dir (project is self-contained here)
    return { dbPath: directDb, repoPath: resolved };
  }

  // Case B: cwd has a `.tokenzip/db` subdirectory (standard project layout)
  const standardDb = path.join(resolved, '.tokenzip', 'db');
  if (fs.existsSync(standardDb) && fs.statSync(standardDb).isDirectory()) {
    return { dbPath: standardDb, repoPath: resolved };
  }

  // Case C: neither exists yet — assume standard layout (db will be created on init/parse)
  return { dbPath: path.join(resolved, '.tokenzip', 'db'), repoPath: resolved };
}
