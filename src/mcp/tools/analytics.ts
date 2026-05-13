import { UsageTracker } from '../usage-tracker.js';

export function createAnalyticsTools(tracker: UsageTracker) {
  return [
    {
      name: 'get_token_savings',
      description: 'Retrieve real-time analytics on token savings achieved by using TokenZip tools in this session.',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['summary', 'detailed'], default: 'summary' }
        }
      },
      handler: async (args: any) => {
        const stats = await tracker.getSummary();
        
        if (args.format === 'detailed') {
          return {
            content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
          };
        }

        const text = [
          `📊 **TokenZip ROI Dashboard**`,
          `---------------------------`,
          `Total Tool Calls:   ${stats.callCount}`,
          `Tokens Consumed:    ${stats.totalSmart.toLocaleString()}`,
          `Tokens Avoided:      ${stats.totalNaive.toLocaleString()}`,
          `---------------------------`,
          `🚀 **Net Savings:   ${stats.totalSaved.toLocaleString()} tokens**`,
          `📈 **Avg Efficiency: ${stats.avgSavings.toFixed(1)}%**`
        ].join('\n');

        return {
          content: [{ type: 'text', text }],
        };
      }
    }
  ];
}
