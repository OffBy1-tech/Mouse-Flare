#!/usr/bin/env node
// Regenerates the embedded preset literals in both native DefaultFxPresets
// files from data/default-fx-presets.json. `--check` verifies instead.
import { readFileSync, writeFileSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const DATA = 'data/default-fx-presets.json';

// Match the historical literal format: minified, ", "-separated, ": " after
// keys, non-ASCII escaped as \uXXXX (so the emoji icons survive any editor).
// NOTE: keep the -￿ character class as written — retyping it by
// hand risks the escapes being converted to raw characters by tooling.
const escapeNonAscii = (s) =>
  s.replace(/[\u007f-\uffff]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
const presets = JSON.parse(readFileSync(DATA, 'utf8'));
const literal = escapeNonAscii(
  JSON.stringify(presets, null, 1).replace(/\n\s*/g, ' ').replace(/ \]$/, ']').replace(/^\[ /, '[')
);

const targets = [
  {
    file: 'src/native/macos/Sources/DefaultFxPresets.swift',
    render: (json) => `        let json = ##"${json}"##`,
  },
  {
    file: 'src/native/windows/Core/DefaultFxPresets.cs',
    render: (json) => `            const string json = """\n${json}\n""";`,
  },
];

let dirty = false;
for (const { file, render } of targets) {
  const src = readFileSync(file, 'utf8');
  const begin = src.indexOf('GENERATED-PRESETS-BEGIN');
  const end = src.indexOf('GENERATED-PRESETS-END');
  if (begin === -1 || end === -1 || end < begin) {
    console.error(`${file}: GENERATED-PRESETS markers missing or out of order — refusing to write.`);
    process.exit(2);
  }
  const beginLineEnd = src.indexOf('\n', begin) + 1;
  const endLineStart = src.lastIndexOf('\n', end);
  const current = src.slice(beginLineEnd, endLineStart);
  const next = render(literal);
  if (current === next) continue;
  dirty = true;
  if (CHECK) {
    console.error(`${file}: embedded presets differ from ${DATA} (run \`bun run generate:presets\`).`);
  } else {
    writeFileSync(file, src.slice(0, beginLineEnd) + next + src.slice(endLineStart));
    console.log(`${file}: regenerated.`);
  }
}
if (CHECK && dirty) process.exit(1);
if (!dirty) console.log('presets in sync.');
