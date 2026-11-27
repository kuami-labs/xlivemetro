// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // db/data : fichiers de PostgreSQL ; .next, dist : fichiers générés
  globalIgnores(['**/dist/', '**/.next/', 'db/data/', 'coverage/']),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
