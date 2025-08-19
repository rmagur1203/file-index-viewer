import { rmdir } from "fs/promises";

await rmdir("dist", { recursive: true });

await Bun.build({
  entrypoints: ["index.ts"],
  outdir: "dist",
  target: "bun",
  packages: "bundle",
  external: [
    "sharp",
    "canvas",
    "pdf-parse",
    "tesseract.js",
    "@tensorflow/tfjs-node",
    "@xenova/transformers",
    "ffmpeg-static",
  ],
  minify: true,
  splitting: true,
  sourcemap: "linked",
  bytecode: false,
});
