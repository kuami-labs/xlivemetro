import { existsSync } from 'node:fs';

// .env à la racine du monorepo (docs/06-ENVIRONNEMENT.md), s'il existe.
// Importé en premier par main.ts : en ESM, les imports s'exécutent avant le corps du module.
const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
