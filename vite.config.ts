import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: root("./index.html"),
        sword: root("./sword.html"),
      },
    },
  },
});
