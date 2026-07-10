// Content-aware text compressor — runs before PNG stage
// Returns { compressed, ratio, type }

export function detectType(text) {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (/^\s*(import|export|function|class|const|def |fn |pub fn)/.test(t)) return 'code';
  if (/^\d{4}-\d{2}-\d{2}|\[INFO\]|\[ERROR\]|\[WARN\]|^\s+at /.test(t)) return 'logs';
  if (/^[\w\s,.|#\-*>]+$/.test(t) && t.length > 200) return 'prose';
  return 'generic';
}

export function compressJSON(text) {
  try {
    const obj = JSON.parse(text);
    // Remove null values, collapse arrays of primitives
    const cleaned = removeNulls(obj);
    return JSON.stringify(cleaned);
  } catch {
    // Not valid JSON, do structural compression
    return text
      .replace(/:\s+null,?\n?/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*\n\s*/g, ', ')
      .trim();
  }
}

function removeNulls(obj) {
  if (Array.isArray(obj)) return obj.filter(v => v !== null).map(removeNulls);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, removeNulls(v)])
    );
  }
  return obj;
}

export function compressCode(text) {
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      // Remove blank lines and pure comment lines
      if (t === '') return false;
      if (/^\/\//.test(t) || /^#/.test(t) || /^\/\*/.test(t) || /^\*/.test(t)) return false;
      return true;
    })
    .join('\n');
}

export function compressLogs(text) {
  const lines = text.split('\n');
  const seen = new Map();
  const out = [];

  for (const line of lines) {
    // Normalize timestamps and IDs to get a signature
    const sig = line
      .replace(/\d{4}-\d{2}-\d{2}T?\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<ts>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/\b\d{5,}\b/g, '<id>')
      .trim();

    if (!sig) continue;
    const count = (seen.get(sig) || 0) + 1;
    seen.set(sig, count);
    if (count === 1) out.push(line);
    else if (count === 2) out[out.length - 1] += ` [×${count}]`;
    else {
      // Update the count on the last occurrence
      out[out.length - 1] = out[out.length - 1].replace(/\[×\d+\]$/, `[×${count}]`);
    }
  }
  return out.join('\n');
}

export function compressProse(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')           // collapse excess blank lines
    .replace(/[ \t]{2,}/g, ' ')            // collapse spaces
    .replace(/\b(the|a|an|very|just|really|actually|basically|essentially)\b /gi, '') // filler words
    .trim();
}

export function compress(text) {
  if (!text || text.length < 500) return { compressed: text, ratio: 1, type: 'passthrough' };

  const type = detectType(text);
  let compressed = text;

  switch (type) {
    case 'json':    compressed = compressJSON(text); break;
    case 'code':    compressed = compressCode(text); break;
    case 'logs':    compressed = compressLogs(text); break;
    case 'prose':   compressed = compressProse(text); break;
    default:        compressed = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
  }

  const ratio = compressed.length / text.length;
  return { compressed, ratio, type };
}
