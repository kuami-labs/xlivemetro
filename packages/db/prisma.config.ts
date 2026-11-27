import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// .env à la racine du monorepo (docs/06-ENVIRONNEMENT.md), comme l’API :
// pnpm db:migrate et prisma studio trouvent DATABASE_URL sans l'exporter à la main.
const envFile = new URL('../../.env', import.meta.url);
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // process.env plutôt que env() : `prisma generate` (build, CI) fonctionne sans base.
  datasource: { url: process.env.DATABASE_URL },
});
