import { IStore } from '../storage/interface.js';
import { TokenBudgetManager } from './token-budget.js';
import fs from 'fs';
import path from 'path';

export class UsageTracker {
  constructor(private store: IStore, private repoPath: string, private budget: TokenBudgetManager) {}

  async log(toolName: string, smartContent: string, filePath?: string) {
    const smartTokens = this.budget.estimate(smartContent);
    let naiveTokens = smartTokens;

    if (filePath) {
      const absPath = path.resolve(this.repoPath, filePath);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const fullContent = fs.readFileSync(absPath, 'utf-8');
        naiveTokens = this.budget.estimate(fullContent);
      }
    }


    const savingsPercent = naiveTokens > 0 
      ? Math.max(0, ((naiveTokens - smartTokens) / naiveTokens) * 100) 
      : 0;

    await this.store.query(`
      CREATE usage_log SET 
        tool_name = $toolName,
        file_path = $filePath,
        smart_tokens = $smartTokens,
        naive_tokens = $naiveTokens,
        savings_percent = $savingsPercent
    `, { toolName, filePath, smartTokens, naiveTokens, savingsPercent });
    
    return { smartTokens, naiveTokens, savingsPercent };
  }

  async getSummary() {
    let logs: any[] = [];
    try {
      const res = await this.store.query<any>(`
        SELECT 
          smart_tokens,
          naive_tokens,
          savings_percent
        FROM usage_log
      `);
      logs = Array.isArray(res) ? res : [];
    } catch (err) {
      console.error('Error fetching usage summary:', err);
    }
    
    let totalSmart = 0;
    let totalNaive = 0;
    let totalSavingsPercent = 0;

    for (const log of logs) {
      totalSmart += log.smart_tokens || 0;
      totalNaive += log.naive_tokens || 0;
      totalSavingsPercent += log.savings_percent || 0;
    }
    
    const callCount = logs.length;
    const totalSaved = totalNaive - totalSmart;
    const avgSavings = callCount > 0 ? totalSavingsPercent / callCount : 0;
    
    return {
      callCount,
      totalSmart,
      totalNaive,
      totalSaved,
      avgSavings
    };
  }
}
