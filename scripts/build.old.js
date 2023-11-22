import { GasPlugin } from "esbuild-gas-plugin";
import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["src/server/main.ts"],
    bundle: true,
    outfile: "dist/main.js",
    plugins: [GasPlugin],
    target: "ES2019",
  })
  .catch((e) => {
    console.error(e);
  });
