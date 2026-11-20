// Neon Sunset Cover Studio — the entry program.
//
// Hands the app in: copies app/ and screenshots/ from this repository into
// the output directory and writes dossier.json with buildDossier from the
// kit's vendor/makefun-app.ts. Node 22, standard library only. Running it
// twice writes byte-identical output.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the directory this file lives in.
const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

// The grader writes to /output; anywhere else, MAKEFUN_OUTPUT_DIR stands in.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The competition's gate caps, as competition.yaml and the kit's gate set them.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function clearOutputDir(dir: string): void {
  // Start clean so a stale file from an earlier run can never leak into the
  // dossier: remove the three things this program writes, then recreate them.
  rmSync(join(dir, 'app'), { recursive: true, force: true });
  rmSync(join(dir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(dir, 'dossier.json'), { force: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'screenshots'), { recursive: true });
}

function copyTree(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
}

function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  clearOutputDir(OUTPUT_DIR);
  copyTree(join(REPO_ROOT, 'app'), join(OUTPUT_DIR, 'app'));
  copyTree(join(REPO_ROOT, 'screenshots'), join(OUTPUT_DIR, 'screenshots'));
  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
}

main();
