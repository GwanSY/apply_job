import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const watch = process.argv.includes("--watch");

const sharedOptions = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
  jsx: "automatic"
};

async function ensureDist() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  if (existsSync(path.join(__dirname, "public"))) {
    await cp(path.join(__dirname, "public"), distDir, { recursive: true });
  }
  const panelCssExists = existsSync(path.join(distDir, "assets", "panel.css"));
  const panelHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ApplyJob</title>
    ${panelCssExists ? '<link rel="stylesheet" href="./assets/panel.css" />' : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/panel.js"></script>
  </body>
</html>`;
  await writeFile(path.join(distDir, "panel.html"), panelHtml, "utf8");
}

async function runBuild() {
  await rm(distDir, { recursive: true, force: true });

  const panelConfig = {
    ...sharedOptions,
    entryPoints: [path.join(__dirname, "src/panel/main.tsx")],
    outfile: path.join(distDir, "assets/panel.js"),
    loader: {
      ".css": "css"
    }
  };

  const backgroundConfig = {
    ...sharedOptions,
    entryPoints: [path.join(__dirname, "src/background/index.ts")],
    outfile: path.join(distDir, "background.js")
  };

  const contentConfig = {
    ...sharedOptions,
    entryPoints: [path.join(__dirname, "src/content/index.ts")],
    outfile: path.join(distDir, "content.js")
  };

  if (watch) {
    const panelCtx = await context(panelConfig);
    const backgroundCtx = await context(backgroundConfig);
    const contentCtx = await context(contentConfig);
    await Promise.all([panelCtx.watch(), backgroundCtx.watch(), contentCtx.watch()]);
    await ensureDist();
    console.log("watch mode ready");
    return;
  }

  await Promise.all([build(panelConfig), build(backgroundConfig), build(contentConfig)]);
  await ensureDist();
}

runBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
