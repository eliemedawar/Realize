/**
 * One-off image optimizer for the site's photos.
 * Converts the large PNG photos to resized WebP (originals are kept as backup).
 *
 * Run:  node scripts/optimize-images.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const IMG_DIR = path.join(__dirname, '..', 'public', 'images');

// { source PNG, output WebP, max width in px, quality }
const JOBS = [
  { src: 'hero-therapy-room.png',      out: 'hero-therapy-room.webp',      width: 1200, quality: 80 },
  { src: 'about-therapy-session.png',  out: 'about-therapy-session.webp',  width: 1000, quality: 80 },
  { src: 'logo-mark.png',              out: 'logo-mark.webp',              width: 240,  quality: 90 }
];

(async () => {
  for (const job of JOBS) {
    const srcPath = path.join(IMG_DIR, job.src);
    const outPath = path.join(IMG_DIR, job.out);
    const before = fs.statSync(srcPath).size;

    await sharp(srcPath)
      .resize({ width: job.width, withoutEnlargement: true })
      .webp({ quality: job.quality })
      .toFile(outPath);

    const after = fs.statSync(outPath).size;
    const pct = Math.round((1 - after / before) * 100);
    const kb = (n) => (n / 1024).toFixed(0) + ' KB';
    console.log(job.src + ' (' + kb(before) + ') -> ' + job.out + ' (' + kb(after) + ')  −' + pct + '%');
  }
})().catch((e) => { console.error(e); process.exit(1); });
