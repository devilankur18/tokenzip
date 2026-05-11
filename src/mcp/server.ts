import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { IStore } from '../storage/interface.js';
import { TokenBudgetManager } from './token-budget.js';
import { registerTools } from './tools/registry.js';

export async function createMcpServer(store: IStore, repoPath: string) {
  const server = new Server(
    { name: 'tokenzip', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const budget = new TokenBudgetManager();
  const tools = registerTools(store, repoPath, budget);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Tool ${request.params.name} not found`);
    }
    return tool.handler(request.params.arguments);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
