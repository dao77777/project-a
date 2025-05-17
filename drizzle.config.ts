import '@/envConfig';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './app/(db)/migrations',
  schema: './app/(db)/schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
