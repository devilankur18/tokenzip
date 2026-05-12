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

  // Case A: Are we inside a .tokenzip directory already?
  if (resolved.endsWith('.tokenzip') || resolved.includes('/.tokenzip/')) {
    const rootOfTokenzip = resolved.split('/.tokenzip')[0] + '/.tokenzip';
    const db = path.join(rootOfTokenzip, 'db');
    return { dbPath: db, repoPath: path.dirname(rootOfTokenzip) };
  }

  // Case B: Does cwd have a .tokenzip/db subdirectory?
  const standardDb = path.join(resolved, '.tokenzip', 'db');
  if (fs.existsSync(standardDb)) {
    return { dbPath: standardDb, repoPath: resolved };
  }

  // Case C: neither exists yet — assume standard layout (db will be created on init/parse)
  return { dbPath: path.join(resolved, '.tokenzip', 'db'), repoPath: resolved };
}
