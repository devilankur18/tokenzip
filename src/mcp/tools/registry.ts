import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createStructureTools } from './structure.js';
import { createSymbolTools } from './symbol.js';
import { createSmartFileReadTools } from './smart-file-read.js';

export function registerTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  const tools: any[] = [];
  tools.push(...createStructureTools(store, repoPath, budget));
  tools.push(...createSymbolTools(store, repoPath, budget));
  tools.push(...createSmartFileReadTools(store, repoPath, budget));
  return tools;
}
