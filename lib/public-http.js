const https = require('https');
const dns = require('dns').promises;
const net = require('net');

// Resolve on every connection and pin the checked address to prevent DNS rebinding.
function isPublicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (net.isIP(address) === 6) {
    const normalized = new URL(`http://[${address}]`).hostname.slice(1, -1);
    const [first, second] = normalized.split(':').slice(0, 2).map(part => parseInt(part || '0', 16));
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 &&
      !(first === 0x2001 && (second < 0x0200 || second === 0x0db8));
  }
  return false;
}

function publicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) throw new Error('INVALID_PUBLIC_URL');
  return url;
}

async function publicRequest(value, { method = 'GET', headers = {}, body, maxBytes = 8_000_000, timeoutMs = 20_000 } = {}) {
  const url = publicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('PRIVATE_DESTINATION');
  const address = addresses.find(item => item.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: { 'User-Agent': 'Folio/0.1 (+https://folio.yuris.io)', ...headers },
      lookup: (_host, options, callback) => options?.all ? callback(null, [address]) : callback(null, address.address, address.family)
    }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) req.destroy(new Error('RESPONSE_TOO_LARGE'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        if (size > maxBytes) return;
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('HTTP_TIMEOUT')), timeoutMs);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

module.exports = { isPublicAddress, publicUrl, publicRequest };
