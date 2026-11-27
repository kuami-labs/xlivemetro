#!/usr/bin/env node
// Serveur MCP de XLiveMetro (stdio) : état du réseau ferré d'Île-de-France et liens vers la carte.
// Variables : XLIVEMETRO_API_URL (API), XLIVEMETRO_WEB_URL (carte, pour les liens).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XLiveMetroApi } from './api.js';
import { createServer } from './server.js';

const apiUrl = process.env.XLIVEMETRO_API_URL ?? 'http://localhost:4000';
const webUrl = process.env.XLIVEMETRO_WEB_URL ?? 'http://localhost:3000';

const server = createServer(new XLiveMetroApi(apiUrl), webUrl);
await server.connect(new StdioServerTransport());
// stdout est réservé au protocole : les messages vont sur stderr
console.error(`xlivemetro-mcp prêt (API ${apiUrl})`);
