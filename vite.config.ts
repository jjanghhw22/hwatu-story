import { defineConfig } from 'vite';
// GitHub Pages는 하위 경로(/hwatu-story/)에 올라가므로 base를 환경변수(VITE_BASE)로 받는다. 로컬 dev·build는 '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { host: '127.0.0.1' },
});
