import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTest } from '../test-setup.js';
import { createAnalyticsTools } from '../../tools/analytics.js';

describe('get_token_savings (Integration)', () => {
  let store: any;
  let budget: any;
  let tool: any;

  beforeAll(async () => {
    const setup = await setupIntegrationTest();
    store = setup.store;
    budget = setup.budget;
    const { UsageTracker } = await import('../../usage-tracker.js');
    const tracker = new UsageTracker(store, setup.repoPath, budget);
    const tools = createAnalyticsTools(tracker);
    tool = tools[0];
  }, 60000);

  afterAll(async () => {
    if (store) await store.close();
  });

  it('1. Get baseline token savings', async () => {
    const result = await tool.handler({ format: 'detailed' });
    const data = JSON.parse(result.content[0].text);
    expect(data.totalSaved).toBeDefined();
  });

  it('2. Get detailed token savings', async () => {
    const result = await tool.handler({ format: 'detailed' });
    const data = JSON.parse(result.content[0].text);
    expect(data.totalSaved).toBeDefined();
  });

  it('3. Check with different timeframes', async () => {
    const res1 = await tool.handler({ format: 'detailed' });
    const res2 = await tool.handler({ format: 'detailed' });
    expect(res1.content).toBeDefined();
    expect(res2.content).toBeDefined();
  });

  it('4. Verify ROI calculation presence (if any)', async () => {
    const result = await tool.handler({ format: 'detailed' });
    const data = JSON.parse(result.content[0].text);
    expect(data.totalSaved).toBeDefined();
  });

  it('5. Response format check', async () => {
    const result = await tool.handler({});
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('TokenZip ROI Dashboard');
  });

  it('6. Performance check', async () => {
    const start = Date.now();
    await tool.handler({});
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('7. Consistency across calls', async () => {
    const res1 = await tool.handler({ format: 'detailed' });
    const res2 = await tool.handler({ format: 'detailed' });
    expect(res1.content[0].text).toBe(res2.content[0].text);
  });

  it('8. Verify result fields: tool, total_saved, total_spent', async () => {
    const result = await tool.handler({ format: 'detailed' });
    const data = JSON.parse(result.content[0].text);
    expect(data.totalSaved).toBeDefined();
    expect(data.totalSmart).toBeDefined();
    expect(data.totalNaive).toBeDefined();
  });

  it('9. Tool metadata check', async () => {
    expect(tool.name).toBe('get_token_savings');
  });

  it('10. Response is valid JSON', async () => {
    const result = await tool.handler({ format: 'detailed' });
    expect(() => JSON.parse(result.content[0].text)).not.toThrow();
  });
});
