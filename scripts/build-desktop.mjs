import { build } from "esbuild";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const folder = "desktop-dist/app";
await mkdir(folder, { recursive: true });
await build({
  entryPoints: ["desktop/main.ts"],
  outfile: folder + "/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron", "@playwright/test", "vite"],
  minify: false,
  legalComments: "linked",
});
await cp("dist", folder + "/dist", { recursive: true, force: true });
await cp("build/icon.png", folder + "/icon.png");
await writeFile(
  folder + "/package.json",
  JSON.stringify(
    {
      name: pkg.name,
      productName: "Drum Canvas",
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      main: "main.cjs",
      private: true,
    },
    null,
    2,
  ),
);
await cp("build/THIRD-PARTY-NOTICES.txt", folder + "/THIRD-PARTY-NOTICES.txt");
