/* -----------------------------------------------------------------------------
   Triverse OS — local static server (no dependencies, no installs)

     node scripts/serve.js            → http://localhost:8099
     node scripts/serve.js 3000       → http://localhost:3000

   Why this exists: a page opened straight off the disk (file://) has an opaque
   origin. Google Drive sign-in refuses to talk to such a page, and the browser
   blocks IndexedDB. Serving the same folder over http fixes both, and it also
   makes the JSON backup / cloud sync path behave exactly like production.
   -------------------------------------------------------------------------- */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8099;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(String(req.url || '/').split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';

  /* keep the server inside the project folder */
  const target = path.normalize(path.join(ROOT, rel));
  if (target.indexOf(ROOT) !== 0) return send(res, 403, 'Forbidden');

  fs.readFile(target, (err, buf) => {
    if (err) {
      /* a clean client-side route falls back to the app shell */
      if (!path.extname(target)) return fs.readFile(path.join(ROOT, 'index.html'), (e2, html) =>
        e2 ? send(res, 404, 'Not found') : send(res, 200, html, TYPES['.html']));
      return send(res, 404, 'Not found: ' + rel);
    }
    send(res, 200, buf, TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log('Triverse OS is running at  http://localhost:' + PORT + '/');
  console.log('(Google Drive sign-in and the file vault work best on this address.)');
  console.log('Press Ctrl+C to stop.');
});
