import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

/** @type {import('rollup').RollupOptions} */
const config = {
  input: "src/index.ts",
  output: {
    esModule: false,
    inlineDynamicImports: true,
    file: "dist/index.cjs",
    format: "cjs",
    sourcemap: true,
    banner: "#!/usr/bin/env node",
  },
  plugins: [
    typescript({
      declaration: false,
      tsconfig: "./tsconfig.json"
    }),
    commonjs(),
    nodeResolve({ preferBuiltins: true }),
    json()
  ],
}

export default config;