import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The placeholder GLB is large; raise the asset inline limit guard and let it be served from /public.
  assetsInclude: ["**/*.hdr"],
  server: {
    port: 5173,
    // Dev: proxy the WebSocket to the FastAPI backend so same-origin /ws works locally too.
    proxy: { "/ws": { target: "ws://localhost:8001", ws: true } },
  },
});
