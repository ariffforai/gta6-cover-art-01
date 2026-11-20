// Neon Sunset Cover Studio — entrypoint.
//
// Hands the app in: copies app/ and screenshots/ from this repository into
// the output directory and writes dossier.json with buildDossier from the
// kit's vendor/makefun-app.ts. Standard library only, no network, no clock:
// the same repository always writes the same bytes.
//
// Run outside the grader with MAKEFUN_OUTPUT_DIR set, e.g.
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The dossier caps are the gate's own: text at most 160 KiB, at most four
// screenshots of at most 256 KiB each, app/ at most 993 entries / 48 MiB.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  console.log(`wrote ${outDir} (dossier.json ${dossier.length} bytes)`);
}

main();
