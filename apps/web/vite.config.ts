import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Falhar fechado: uma build sem variável é sempre noindex. A produção só
  // pode ser indexada quando o respetivo projeto Vercel o declarar.
  const robotsDirective = env.VITE_ROBOTS_DIRECTIVE || 'noindex,nofollow';

  return {
    plugins: [
      react(),
      {
        name: 'valverde-robots-directive',
        transformIndexHtml: {
          order: 'pre',
          handler: (html) => html.replace('%VITE_ROBOTS_DIRECTIVE%', robotsDirective)
        }
      }
    ],
    server: { strictPort: true },
    preview: { strictPort: true }
  };
});
