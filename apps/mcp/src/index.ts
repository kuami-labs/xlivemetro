#!/usr/bin/env node
// Serveur MCP de XLiveMetro (stdio). Les outils arrivent avec feature/mcp (docs/03-BACKEND.md).
export const API_URL = process.env.XLIVEMETRO_API_URL ?? 'http://localhost:4000';
