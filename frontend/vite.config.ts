import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // El backend (Fase 2) corre en :3000 según la documentación de handoff.
      // Todas las llamadas HTTP del frontend pasan por aquí, nunca directo a MinIO/MariaDB.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
      // APP-10: el Dataset Copilot es un servicio Python aparte (no una ruta
      // del backend Node), servido localmente con
      // `python -m dataset_quality.copilot` desde pipeline/ (puerto 8100 por
      // default, ver Settings.copilot_port).
      "/copilot": {
        target: "http://localhost:8100",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/copilot/, ""),
      },
    },
  },
});
