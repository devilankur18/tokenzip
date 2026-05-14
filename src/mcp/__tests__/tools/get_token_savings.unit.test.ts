import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalyticsTools } from '../../tools/analytics.js';

describe('get_token_savings (Unit)', () => {
  let mockTracker: any;
  let tool: any;

  beforeEach(() => {
    mockTracker = {
      getSummary: vi.fn()
    };
    const tools = createAnalyticsTools(mockTracker as any);
    tool = tools.find(t => t.name === 'get_token_savings');
  });

  it('1. Success - returns summary text', async () => {
    mockTracker.getSummary.mockResolvedValue({
      callCount: 10,
      totalSmart: 1000,
      totalNaive: 5000,
      totalSaved: 4000,
      avgSavings: 80
    });
    const result = await tool.handler({ format: 'summary' });
    expect(result.content[0].text).toContain('TokenZip ROI Dashboard');
    expect(result.content[0].text).toContain('4,000 tokens');
  });

  it('2. Detailed format - returns JSON', async () => {
    const stats = { callCount: 1 };
    mockTracker.getSummary.mockResolvedValue(stats);
    const result = await tool.handler({ format: 'detailed' });
    const data = JSON.parse(result.content[0].text);
    expect(data.callCount).toBe(1);
  });

  it('3. Handles zero savings', async () => {
    mockTracker.getSummary.mockResolvedValue({
      callCount: 0,
      totalSmart: 0,
      totalNaive: 0,
      totalSaved: 0,
      avgSavings: 0
    });
    const result = await tool.handler({ format: 'summary' });
    expect(result.content[0].text).toContain('Net Savings:   0 tokens');
  });

  it('4. Handles large numbers with formatting', async () => {
    mockTracker.getSummary.mockResolvedValue({
      callCount: 1000,
      totalSmart: 1000000,
      totalNaive: 10000000,
      totalSaved: 9000000,
      avgSavings: 90
    });
    const result = await tool.handler({ format: 'summary' });
    expect(result.content[0].text).toContain('9,000,000 tokens');
  });

  it('5. Tool name check', async () => {
    expect(tool.name).toBe('get_token_savings');
  });

  it('6. Tool description check', async () => {
    expect(tool.description).toContain('analytics');
  });

  it('7. Verify average efficiency formatting', async () => {
    mockTracker.getSummary.mockResolvedValue({
      callCount: 1,
      totalSmart: 100,
      totalNaive: 333,
      totalSaved: 233,
      avgSavings: 69.9699
    });
    const result = await tool.handler({ format: 'summary' });
    expect(result.content[0].text).toContain('70.0%');
  });

  it('8. Verify text lines presence', async () => {
    mockTracker.getSummary.mockResolvedValue({
      callCount: 1, totalSmart: 1, totalNaive: 1, totalSaved: 1, avgSavings: 1
    });
    const result = await tool.handler({});
    expect(result.content[0].text.split('\n').length).toBeGreaterThan(5);
  });

  it('9. Tool metadata check', async () => {
    expect(tool.inputSchema.properties.format.enum).toContain('detailed');
  });

  it('10. Concurrent calls resilience', async () => {
    mockTracker.getSummary.mockResolvedValue({ callCount: 1, totalSmart: 1, totalNaive: 1, totalSaved: 1, avgSavings: 1 });
    const results = await Promise.all([
      tool.handler({ format: 'detailed' }),
      tool.handler({ format: 'summary' })
    ]);
    expect(results).toHaveLength(2);
  });
});
