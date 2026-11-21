// Bundles the Vercel entry point (src/vercel.ts) into dist/vercel-handler.js.
//
// Why bundle: sanitize-html is CommonJS and require()s htmlparser2, which is
// ESM-only since v12. Plain Node 22+ allows that, but Vercel's function loader
// does not, so every request crashed with ERR_REQUIRE_ESM. Bundling sanitize-html
// and its dependencies turns that require() into ordinary bundled code.
// Every other dependency stays external and is loaded from node_modules as usual.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const BUNDLED = new Set(["sanitize-html"]);
const external = Object.keys(pkg.dependencies)
  .filter((name) => !BUNDLED.has(name))
  .flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: [fileURLToPath(new URL("../src/vercel.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../dist/vercel-handler.js", import.meta.url)),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: [...external, "@better-auth/*"],
  // Bundled CommonJS code calls require() for Node built-ins; ESM output needs it defined.
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  sourcemap: true,
  logLevel: "warning",
});
