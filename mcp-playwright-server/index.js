import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { registerTools } from './registerTools.js';

serveStdio(() => {
    const server = new McpServer({
        name: 'playwright-automation',
        version: '1.0.0',
    });

    registerTools(server);

    return server;
});
