import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

/** @type {import('rollup').RollupOptions} */
const config = {
  input: "src/index.js",
  output: {
    esModule: true,
    inlineDynamicImports: true,
    file: "dist/index.js",
    format: "es",
    sourcemap: true,
  },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), json()],
}

export default config;