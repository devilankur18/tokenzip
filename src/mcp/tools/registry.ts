import { IStore } from '../../storage/interface.js';
import { TokenBudgetManager } from '../token-budget.js';
import { UsageTracker } from '../usage-tracker.js';
import { createAnalyticsTools } from './analytics.js';

// V2 Tools
import { createSnapshotTool } from './v2/snapshot.js';
import { createSearchTool } from './v2/search.js';
import { createReadTool } from './v2/read.js';
import { createTraceTool } from './v2/trace.js';
import { createInsightTool } from './v2/insight.js';

import { createStructureTools } from './structure.js';
import { createSymbolTools } from './symbol.js';
import { createSearchTools as createLegacySearchTools } from './search.js';
import { createNavigationTools } from './navigation.js';
import { createCortexTools } from './cortex.js';
import { createSmartFileReadTools } from './smart-file-read.js';

/**
 * Legacy tools are preserved in the codebase but removed from MCP registration 
 * to provide a cleaner, actionable interface (Recall Kit).
 * Set includeLegacy to true for testing and CLI comparison.
 */
export function registerTools(store: IStore, repoPath: string, budget: TokenBudgetManager, includeLegacy: boolean = false) {
  const tracker = new UsageTracker(store, repoPath, budget);
  
  const tools: any[] = [
    createSnapshotTool(store, repoPath, budget),
    createSearchTool(store, budget),
    createReadTool(store, repoPath, budget),
    createTraceTool(store, budget),
    createInsightTool(store, budget)
  ];

  if (includeLegacy) {
    tools.push(
      ...createStructureTools(store, repoPath, budget),
      ...createSymbolTools(store, repoPath, budget),
      ...createLegacySearchTools(store, repoPath, budget),
      ...createNavigationTools(store, repoPath, budget),
      ...createCortexTools(store, budget),
      ...createSmartFileReadTools(store, repoPath, budget)
    );
  }
  
  // Wrap tools with usage tracking for ROI analytics
  const wrappedTools = tools.map(tool => ({
    ...tool,
    handler: async (args: any) => {
      const result = await tool.handler(args);
      if (!result.isError && result.content && result.content[0]?.type === 'text') {
        let filePath = args.path || args.filePath || args.file_path;
        
        if (!filePath) {
          try {
            const data = JSON.parse(result.content[0].text);
            filePath = data.path || data.filePath || (data.target && data.target.filePath);
          } catch (e) { /* ignore */ }
        }
        
        await tracker.log(tool.name, result.content[0].text, filePath);
      }
      return result;
    }
  }));

  // Keep analytics tool for ROI visibility
  wrappedTools.push(...createAnalyticsTools(tracker));

  return wrappedTools;
}
