import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this folder so Next.js doesn't pick up a stray
  // lockfile (e.g. ~/yarn.lock) and warn about ambiguous roots.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
