import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/memory.ts",
    "src/adapters/neon-http.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  target: "es2022",
  external: ["@neondatabase/serverless"],
});
