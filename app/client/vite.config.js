import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "login.html"),
        signup: resolve(__dirname, "signup.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  preview: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
