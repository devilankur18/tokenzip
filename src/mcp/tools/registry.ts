import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { createStructureTools } from './structure.js';
import { createSymbolTools } from './symbol.js';
import { createSmartFileReadTools } from './smart-file-read.js';
import { createFetchMetadataTools } from './fetch-metadata.js';
import { createSearchTools } from './search.js';
import { createNavigationTools } from './navigation.js';
import { createContextTools } from './context.js';
import { UsageTracker } from '../usage-tracker.js';
import { createAnalyticsTools } from './analytics.js';
import { createCortexTools } from './cortex.js';

export function registerTools(store: IStore, repoPath: string, budget: TokenBudgetManager) {
  const tracker = new UsageTracker(store, repoPath, budget);
  const tools: any[] = [];
  
  tools.push(...createStructureTools(store, repoPath, budget));
  tools.push(...createSymbolTools(store, repoPath, budget));
  tools.push(...createSmartFileReadTools(store, repoPath, budget));
  tools.push(...createFetchMetadataTools(store, budget));
  tools.push(...createSearchTools(store, repoPath, budget));
  tools.push(...createNavigationTools(store, repoPath, budget));
  tools.push(...createContextTools(store, repoPath, budget));
  tools.push(...createCortexTools(store, repoPath, budget));
  
  // Wrap existing tools with usage tracking
  const wrappedTools = tools.map(tool => ({
    ...tool,
    handler: async (args: any) => {
      const result = await tool.handler(args);
      // Log usage if it's a successful text response
      if (!result.isError && result.content && result.content[0]?.type === 'text') {
        let filePath = args.path || args.filePath || args.file_path;
        
        // Try to extract path from JSON response if not in args
        if (!filePath) {
          try {
            const data = JSON.parse(result.content[0].text);
            filePath = data.path || data.filePath || (data.target && data.target.filePath);
          } catch (e) {
            // Not JSON or no path found, ignore
          }
        }
        
        await tracker.log(tool.name, result.content[0].text, filePath);
      }
      return result;
    }
  }));

  // Add analytics tools (unwrapped to avoid circular logging)
  wrappedTools.push(...createAnalyticsTools(tracker));

  return wrappedTools;
}
