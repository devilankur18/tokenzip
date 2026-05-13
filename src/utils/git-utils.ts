import { execSync } from 'child_process';
import path from 'path';

export interface GitFileMetadata {
  hash: string;
  path: string;
}

export class GitUtils {
  static getGitHashes(repoPath: string): Map<string, string> {
    const hashes = new Map<string, string>();
    try {
      // -s: show stage, -z: nul-terminated
      const output = execSync('git ls-files -s', { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      
      const lines = output.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Format: <mode> <hash> <stage> <path>
        // Example: 100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0 src/index.ts
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const hash = parts[1];
          const relativePath = parts.slice(3).join(' '); // Handle paths with spaces
          hashes.set(relativePath, hash);
        }
      }
    } catch (e) {
      // Not a git repo or git not installed
    }
    return hashes;
  }

  static isGitRepo(repoPath: string): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath, stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  static getRepoName(repoPath: string): string {
    try {
      // 1. Try to get the name from the git remote origin
      const originUrl = execSync('git remote get-url origin', { cwd: repoPath, encoding: 'utf8' }).trim();
      // Match repo name from:
      // https://github.com/user/repo.git
      // git@github.com:user/repo.git
      const match = originUrl.match(/\/([^/.]+)(\.git)?$/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      // Not a git repo or no remote origin
    }

    // 2. Fallback: use the directory name of the repo root
    return path.basename(repoPath);
  }
}
