import { readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const mainPath = "frontend/src/main.tsx";
const cssPath = "frontend/src/about-admin-layout-fixes.css";

if (!existsSync(mainPath)) {
  console.error("Could not find frontend/src/main.tsx. Run this script from the GuardAI repository root.");
  process.exit(1);
}
if (!existsSync(cssPath)) {
  console.error("Could not find frontend/src/about-admin-layout-fixes.css. Extract the complete visual-fix package first.");
  process.exit(1);
}

let source = await readFile(mainPath, "utf8");
const importLine = 'import "./about-admin-layout-fixes.css";';
if (source.includes(importLine)) {
  console.log("GuardAI About/Admin visual fixes are already connected. No changes needed.");
  process.exit(0);
}

const cssImports = [...source.matchAll(/^import ["'][^"']+\.css["'];?\s*$/gm)];
if (!cssImports.length) {
  console.error("No existing stylesheet imports found in main.tsx. No files were changed.");
  process.exit(1);
}
const lastImport = cssImports.at(-1);
const insertion = lastImport.index + lastImport[0].length;
const updated = source.slice(0, insertion) + "\n" + importLine + source.slice(insertion);

const backupPath = `${mainPath}.visual-fix-backup`;
if (!existsSync(backupPath)) await copyFile(mainPath, backupPath);
await writeFile(mainPath, updated, "utf8");
console.log("GuardAI About/Admin visual fixes connected successfully.");
console.log(`Updated: ${mainPath}`);
console.log(`Loaded last: ${cssPath}`);
console.log(`Backup: ${backupPath}`);
