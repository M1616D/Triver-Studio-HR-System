/* find emoji / pictographs in the app source so copy stays plain and professional */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'js');

/* ranges that only ever contain emoji or dingbats, never icon-font markup */
const RANGES = [
  [0x2190, 0x21ff], [0x2300, 0x23ff], [0x2460, 0x24ff], [0x25a0, 0x27bf],
  [0x2b00, 0x2bff], [0xfe0f, 0xfe0f], [0x1f000, 0x1faff]
];

function emojisIn(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (RANGES.some(r => cp >= r[0] && cp <= r[1])) out.push(ch);
  }
  return out;
}

let total = 0;
fs.readdirSync(DIR).filter(f => f.endsWith('.js')).forEach(f => {
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const hits = emojisIn(line);
    if (hits.length) {
      total += hits.length;
      console.log(f + ':' + (i + 1) + '  [' + hits.join(' ') + ']  ' + line.trim().slice(0, 120));
    }
  });
});
console.log(total ? '\n' + total + ' pictographs found' : 'clean — no emoji in the app source');
