import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: root("./index.html"),
        wand: root("./wand.html"),
        echo: root("./echo.html"),
        sword: root("./sword.html"),
      },
    },
  },
});
