import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/boot.ts",
      name: "Vortex2Plus2Runtime",
      formats: ["iife"],
      fileName: () => "boot.iife.js"
    },
    outDir: "../overrides/v22-runtime",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true
      }
    }
  },
  define: {
    __V22_RUNTIME_VERSION__: JSON.stringify("0.1.0")
  }
});
