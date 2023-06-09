import { defineConfig } from "vite";
import vueJsx from "@vitejs/plugin-vue-jsx";

export default defineConfig({
  plugins: [vueJsx()],
  ssr: {
    noExternal: ["@dangojs/vue3-shap", "lodash"],
  },
});
