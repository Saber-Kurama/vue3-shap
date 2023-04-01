import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import * as path from "path";
import VueJsx from "@vitejs/plugin-vue-jsx";
import viteDts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    VueJsx(),
    viteDts({
      insertTypesEntry: true,
      staticImport: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "./src/index.tsx"),
      name: "shap",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs", "umd"],
    },
    outDir: path.resolve(__dirname, "dist"),
    rollupOptions: {
      external: ["vue"],
      output: {
        globals: {
          vue: "Vue",
        },
      },
    },
  },
});
