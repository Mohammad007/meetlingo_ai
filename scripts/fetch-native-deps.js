#!/usr/bin/env node
/**
 * Downloads the sherpa-onnx Android AAR (Apache-2.0) used by modules/meetlingo-native and verifies its
 * SHA-256 before it is used by Gradle. Runs on `npm install` (postinstall) and via `npm run fetch:native`.
 * The AAR is not committed to git (≈49 MB) and is not published on Maven Central.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const AAR = {
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-2.0.1.aar',
  sha256: 'a8d09d1d32f3eb8520482c6d3d43fae674681c5b050385967c70a3c2c9bf0ee7',
  dest: path.join(__dirname, '..', 'modules', 'meetlingo-native', 'android', 'libs', 'sherpa-onnx-2.0.1.aar'),
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'meetlingo-build' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects > 5) return reject(new Error('Too many redirects'));
          return resolve(download(new URL(res.headers.location, url).toString(), dest, redirects + 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        const tmp = dest + '.part';
        const out = fs.createWriteStream(tmp);
        res.pipe(out);
        out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(); }));
        out.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  if (process.env.MEETLINGO_SKIP_NATIVE_FETCH === '1') return;
  fs.mkdirSync(path.dirname(AAR.dest), { recursive: true });
  if (fs.existsSync(AAR.dest) && sha256(AAR.dest) === AAR.sha256) {
    console.log('[meetlingo] sherpa-onnx AAR present and verified');
    return;
  }
  console.log('[meetlingo] downloading sherpa-onnx 2.0.1 AAR …');
  await download(AAR.url, AAR.dest);
  const got = sha256(AAR.dest);
  if (got !== AAR.sha256) {
    fs.unlinkSync(AAR.dest);
    throw new Error(`sherpa-onnx AAR checksum mismatch: expected ${AAR.sha256}, got ${got}`);
  }
  console.log('[meetlingo] sherpa-onnx AAR verified');
})().catch((e) => {
  console.error('[meetlingo] native dependency fetch failed:', e.message);
  // Do not break `npm install` for JS-only work (tests, typecheck); Gradle fails loudly if the AAR is missing.
  process.exitCode = 0;
});
