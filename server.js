/**
 * Realize Therapy Center — lightweight web server
 * Zero dependencies (Node.js built-ins only). Suitable for small VPS (1 vCPU / 1GB RAM).
 *
 *   Serves the static site from ./public
 *   POST /api/book  -> emails the booking request to BOOKING_TO (nothing is saved)
 *
 * Run:            node server.js
 * Configuration (environment variables):
 *   PORT                (default 3000)
 *   HOST                (default 0.0.0.0)
 *   GMAIL_USER          Gmail address that sends the mail (default realizetherapycenter@gmail.com)
 *   GMAIL_APP_PASSWORD  16-char Gmail App Password  (REQUIRED for email booking to work)
 *   BOOKING_TO          where booking emails are delivered (default realizetherapycenter@gmail.com)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const tls = require('tls');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const GMAIL_USER = process.env.GMAIL_USER || 'realizetherapycenter@gmail.com';
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const BOOKING_TO = process.env.BOOKING_TO || 'realizetherapycenter@gmail.com';

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/* ---------- tiny per-IP rate limiter for the booking endpoint ---------- */
const RATE_LIMIT = 5;                // max bookings
const RATE_WINDOW = 10 * 60 * 1000;  // per 10 minutes
const rateMap = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || [];
  const recent = entry.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) {
    rateMap.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateMap.set(ip, recent);
  return false;
}
// prevent the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of rateMap) {
    const recent = times.filter((t) => now - t < RATE_WINDOW);
    if (recent.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, recent);
  }
}, RATE_WINDOW).unref();

/* ---------- helpers ---------- */
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function clientIP(req) {
  // honor X-Forwarded-For when behind nginx
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function readBody(req, limit, cb) {
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > limit) {
      aborted = true;
      cb(new Error('too_large'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!aborted) cb(null, Buffer.concat(chunks).toString('utf8'));
  });
  req.on('error', () => {
    if (!aborted) { aborted = true; cb(new Error('stream_error')); }
  });
}

// matches ASCII control characters (codes 0-31 and 127), built without
// putting raw control characters in this source file
const CTRL_RE = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']+',
  'g'
);

function clean(str, max) {
  return String(str || '').replace(CTRL_RE, ' ').trim().slice(0, max);
}

/* ---------- minimal SMTP-over-TLS client (Gmail) ---------- */
// Sends a single plain-text email over an implicit-TLS connection (port 465).
// Enough for transactional notifications; not a general-purpose mail library.
function sendGmail(opts, cb) {
  if (!GMAIL_APP_PASSWORD) {
    return cb(new Error('Email is not configured on the server (missing GMAIL_APP_PASSWORD).'));
  }

  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const subjectHeader = '=?UTF-8?B?' + Buffer.from(opts.subject, 'utf8').toString('base64') + '?=';

  const headers = [
    'From: ' + opts.fromName + ' <' + GMAIL_USER + '>',
    'To: ' + opts.to,
    'Reply-To: ' + opts.replyTo,
    'Subject: ' + subjectHeader,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ].join('\r\n');

  // normalize newlines + dot-stuff lines beginning with "." per RFC 5321
  const bodyNorm = String(opts.text).replace(/\r?\n/g, '\r\n');
  const payload = (headers + '\r\n\r\n' + bodyNorm).replace(/\r\n\./g, '\r\n..');

  // conversation: greeting, then a command per step, checking the reply code
  const steps = [
    { expect: 220 },
    { send: 'EHLO realizetherapycenter.com', expect: 250 },
    { send: 'AUTH LOGIN', expect: 334 },
    { send: b64(GMAIL_USER), expect: 334 },
    { send: b64(GMAIL_APP_PASSWORD), expect: 235 },
    { send: 'MAIL FROM:<' + GMAIL_USER + '>', expect: 250 },
    { send: 'RCPT TO:<' + opts.to + '>', expect: 250 },
    { send: 'DATA', expect: 354 },
    { send: payload + '\r\n.', expect: 250 },
    { send: 'QUIT', expect: 221 }
  ];

  const socket = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
  socket.setEncoding('utf8');
  socket.setTimeout(20000);

  let idx = 0;
  let buffer = '';
  let finished = false;

  function finish(err) {
    if (finished) return;
    finished = true;
    try { socket.destroy(); } catch (_) { /* ignore */ }
    cb(err || null);
  }

  socket.on('secureConnect', () => { /* wait for 220 greeting */ });
  socket.on('error', (e) => finish(new Error('SMTP connection error: ' + e.message)));
  socket.on('timeout', () => finish(new Error('SMTP timeout.')));
  socket.on('close', () => { if (!finished) finish(new Error('SMTP connection closed unexpectedly.')); });

  socket.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      if (/^\d{3}-/.test(line)) continue;        // multi-line reply, wait for final line
      if (!/^\d{3}(\s|$)/.test(line)) continue;  // not a status line
      const code = parseInt(line.slice(0, 3), 10);
      const step = steps[idx];
      if (!step) return;
      if (code !== step.expect) {
        return finish(new Error('SMTP error (' + code + '): ' + line));
      }
      idx++;
      const next = steps[idx];
      if (!next) return finish(null);            // QUIT acknowledged — success
      if (next.send != null) socket.write(next.send + '\r\n');
    }
  });
}

/* ---------- booking endpoint (emails, does not store) ---------- */
function handleBooking(req, res) {
  const ip = clientIP(req);
  if (rateLimited(ip)) {
    return sendJSON(res, 429, { error: 'Too many requests. Please try again later or call us directly.' });
  }
  readBody(req, 16 * 1024, (err, raw) => {
    if (err) {
      return sendJSON(res, err.message === 'too_large' ? 413 : 400, { error: 'Invalid request.' });
    }
    let data;
    try { data = JSON.parse(raw); } catch (_) {
      return sendJSON(res, 400, { error: 'Invalid request body.' });
    }

    const booking = {
      name: clean(data.name, 120),
      email: clean(data.email, 200),
      phone: clean(data.phone, 40),
      details: clean(data.details, 2000),
      createdAt: new Date().toISOString()
    };

    if (!booking.name) return sendJSON(res, 400, { error: 'Please enter your full name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(booking.email)) {
      return sendJSON(res, 400, { error: 'Please enter a valid email address.' });
    }
    if (!booking.details) return sendJSON(res, 400, { error: 'Please tell us how we can help.' });

    const text =
      'New appointment booking request from the website:\n\n' +
      'Name:  ' + booking.name + '\n' +
      'Email: ' + booking.email + '\n' +
      'Phone: ' + (booking.phone || '—') + '\n\n' +
      'Details:\n' + booking.details + '\n\n' +
      '— Sent ' + booking.createdAt;

    sendGmail({
      to: BOOKING_TO,
      fromName: 'Realize Therapy Center Website',
      replyTo: booking.name + ' <' + booking.email + '>',
      subject: 'New booking request — ' + booking.name,
      text: text
    }, (mailErr) => {
      if (mailErr) {
        console.error('[booking] email failed:', mailErr.message);
        return sendJSON(res, 502, { error: 'Could not send your request right now. Please try WhatsApp, or call us directly.' });
      }
      console.log('[booking] ' + booking.createdAt + ' emailed request from ' + booking.name + ' <' + booking.email + '>');
      sendJSON(res, 200, { ok: true });
    });
  });
}

/* ---------- static files ---------- */
function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad request');
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  // block path traversal
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // fallback to index for extension-less paths (keeps anchor links working)
      if (path.extname(pathname) === '') {
        return streamFile(path.join(PUBLIC_DIR, 'index.html'), res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    streamFile(filePath, res);
  });
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isHTML = ext === '.html';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': isHTML ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff'
  });
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => { res.destroy(); });
  stream.pipe(res);
}

/* ---------- server ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (url.pathname === '/api/book') {
    if (req.method === 'POST') return handleBooking(req, res);
    return sendJSON(res, 405, { error: 'Method not allowed.' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJSON(res, 405, { error: 'Method not allowed.' });
  }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log('Realize Therapy Center running at http://localhost:' + PORT);
  console.log('Email bookings delivered to: ' + BOOKING_TO);
  if (!GMAIL_APP_PASSWORD) {
    console.log('WARNING: GMAIL_APP_PASSWORD is not set — email booking will fail until you set it.');
  }
});
