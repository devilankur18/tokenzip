import { simpleGit, SimpleGit } from 'simple-git';
import { SurrealStore } from '../storage/surreal/store.js';

export class GitExtractor {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async extractHistory(store: SurrealStore) {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) return;

      console.log('Extracting Git history...');
      
      const log = await this.git.log({ maxCount: 50 });
      console.log(`Found ${log.all.length} commits.`);
      
      for (const entry of log.all) {
        const shortHash = entry.hash.substring(0, 8);
        const commitId = `commit:${shortHash}`;
        
        // Parse the date properly — simple-git returns ISO strings
        let commitDate: Date;
        try {
          commitDate = new Date(entry.date);
        } catch {
          commitDate = new Date();
        }

        await store.createNode({
          id: commitId,
          type: 'commit',
          hash: entry.hash,
          short_hash: shortHash,
          author: entry.author_name,
          email: entry.author_email ?? null,
          date: commitDate,
          message: entry.message,
        } as any).catch(e => console.error(`Failed to create commit node ${commitId}:`, e.message ?? e));

        // Get files changed in this commit
        const show = await this.git.show([entry.hash, '--name-only', '--pretty=format:']);
        const files = show.trim().split('\n').filter(f => f.trim() !== '');

        for (const file of files) {
          // Match how indexer generates file IDs: relativePath.replace(/\W/g, '_')
          const normalizedId = file.replace(/\W/g, '_');
          const fileId = `file:${normalizedId}`;

          await store.query(
            `RELATE ${fileId}->modified_in->${commitId}`,
            {}
          ).catch(() => {
            // File might not exist in current index (deleted, or outside scope)
          });
        }
      }
      
      console.log('Git history extraction complete.');
    } catch (err) {
      console.error('Git extraction failed:', err);
    }
  }
}
