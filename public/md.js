'use strict';
/**
 * Penerjemah Markdown kecil yang dipakai bersama oleh server (PDF, Word, HTML, Telegram) dan browser (tampilan hasil agen).
 * Mendukung: judul (#), paragraf dengan baris baru, daftar (- * + • dan 1.), tabel (|), garis (---), kutipan (>), blok kode,
 * serta **tebal**, *miring*, dan \`kode\`. Tanda yang tidak dikenali dibuang agar tidak tampil sebagai bintang liar.
 * Tidak memakai innerHTML: html() meng-escape semuanya, dom() membuat elemen lewat fungsi h() milik aplikasi.
 */
const Md = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RE_INLINE = /(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1|\*(?=[^\s*])([^*]+?)(?<=[^\s*])\*|`([^`]+)`/g;

  /** Teks satu baris -> [{ t, b, i, c }]. */
  function runs(text) {
    const out = []; let last = 0, m; const re = new RegExp(RE_INLINE.source, 'g'); // regex baru tiap panggilan: runs() rekursif
    const push = (t, f = {}) => { const clean = t.replace(/\*\*|__/g, '').replace(/(^|\s)\*(?=\s|$)/g, '$1'); if (clean) out.push({ t: clean, b: Boolean(f.b), i: Boolean(f.i), c: Boolean(f.c) }); };
    while ((m = re.exec(text))) {
      if (m.index > last) push(text.slice(last, m.index));
      if (m[2] != null) for (const r of runs(m[2])) out.push({ ...r, b: true });
      else if (m[3] != null) for (const r of runs(m[3])) out.push({ ...r, i: true });
      else push(m[4], { c: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) push(text.slice(last));
    return out;
  }
  const SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  /** Markdown -> blok: { t: 'h'|'p'|'ul'|'ol'|'table'|'hr'|'code'|'quote', ... } */
  function parse(md) {
    const lines = String(md == null ? '' : md).replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
    const blocks = []; let i = 0, para = null;
    const flush = () => { if (para) { blocks.push({ t: 'p', lines: para.map(runs) }); para = null; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) { flush(); const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; blocks.push({ t: 'code', text: buf.join('\n') }); continue; }
      if (!l.trim()) { flush(); i++; continue; }
      let m;
      if ((m = /^\s{0,3}(#{1,4})\s+(.*?)\s*#*\s*$/.exec(l))) { flush(); blocks.push({ t: 'h', n: m[1].length, runs: runs(m[2]) }); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); blocks.push({ t: 'hr' }); i++; continue; }
      if (l.includes('|') && i + 1 < lines.length && SEP.test(lines[i + 1]) && cells(l).length > 1) {
        flush(); const head = cells(l).map(runs); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]).map(runs));
        blocks.push({ t: 'table', head, rows }); continue;
      }
      if ((m = /^(\s*)([-*+•])\s+(.*)$/.exec(l)) || (m = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(l))) {
        flush(); const ordered = /\d/.test(m[2]), items = [];
        while (i < lines.length && ((m = /^(\s*)([-*+•])\s+(.*)$/.exec(lines[i])) || (m = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(lines[i])))) {
          const o = /\d/.test(m[2]); if (o !== ordered) break;
          items.push({ level: Math.min(2, Math.floor(m[1].length / 2)), no: o ? Number(m[2]) : null, runs: runs(m[3]) }); i++;
        }
        blocks.push({ t: ordered ? 'ol' : 'ul', items }); continue;
      }
      if (/^\s*>\s?/.test(l)) { flush(); const buf = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); blocks.push({ t: 'quote', lines: buf.map(runs) }); continue; }
      (para = para || []).push(l.trim()); i++;
    }
    flush();
    return blocks;
  }

  const plainRuns = (rs) => rs.map((r) => r.t).join('');
  const angka = (rs) => /^(Rp\.?\s?)?[-+(]?\d[\d.,\s]*\)?\s?(%|‰|jt|rb|juta|miliar|M|hari|poin)?$/i.test(plainRuns(rs).trim()); // sel berisi angka: rata kanan
  const plainLines = (ls) => ls.map(plainRuns).join('\n');

  /** Teks polos rapi (Telegram, salin, unduh .txt): tanpa simbol Markdown. */
  function plain(md) {
    return parse(md).map((b) => {
      switch (b.t) {
        case 'h': return b.n === 1 ? plainRuns(b.runs).toUpperCase() : plainRuns(b.runs);
        case 'p': return plainLines(b.lines);
        case 'quote': return plainLines(b.lines).split('\n').map((x) => '“ ' + x).join('\n');
        case 'ul': return b.items.map((x) => '  '.repeat(x.level) + '• ' + plainRuns(x.runs)).join('\n');
        case 'ol': return b.items.map((x, k) => '  '.repeat(x.level) + (x.no || k + 1) + '. ' + plainRuns(x.runs)).join('\n');
        case 'table': return [b.head, ...b.rows].map((r) => r.map(plainRuns).join(' | ')).join('\n');
        case 'hr': return '———';
        case 'code': return b.text;
        default: return '';
      }
    }).join('\n\n').trim();
  }

  const inlineHtml = (rs) => rs.map((r) => { let x = esc(r.t); if (r.c) x = `<code>${x}</code>`; if (r.i) x = `<em>${x}</em>`; if (r.b) x = `<strong>${x}</strong>`; return x; }).join('');
  /** HTML aman (semua di-escape). */
  function html(md, blocks = parse(md)) {
    return blocks.map((b) => {
      switch (b.t) {
        case 'h': { const lv = Math.min(4, Math.max(2, b.n)); return `<h${lv}>${inlineHtml(b.runs)}</h${lv}>`; } // judul dokumen (h1) dipasang terpisah oleh pembuat berkas
        case 'p': return `<p>${b.lines.map(inlineHtml).join('<br>')}</p>`;
        case 'quote': return `<blockquote>${b.lines.map(inlineHtml).join('<br>')}</blockquote>`;
        case 'ul': return `<ul>${b.items.map((x) => `<li class="l${x.level}">${inlineHtml(x.runs)}</li>`).join('')}</ul>`;
        case 'ol': return `<ol>${b.items.map((x, k) => `<li class="l${x.level}" value="${x.no || k + 1}">${inlineHtml(x.runs)}</li>`).join('')}</ol>`;
        case 'table': { const num = b.head.map((_, k) => b.rows.length > 0 && b.rows.every((r) => angka(r[k] || []) || !plainRuns(r[k] || []).trim())); // kolom angka: kepala ikut rata kanan
          return `<table><thead><tr>${b.head.map((c, k) => `<th${num[k] ? ' class="r"' : ''}>${inlineHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr${/^total\b/i.test(plainRuns(r[0] || []).trim()) ? ' class="jum"' : ''}>${b.head.map((_, k) => `<td${angka(r[k] || []) ? ' class="r"' : ''}>${inlineHtml(r[k] || [])}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
        case 'hr': return '<hr>';
        case 'code': return `<pre>${esc(b.text)}</pre>`;
        default: return '';
      }
    }).join('\n');
  }

  /** Elemen DOM (browser) lewat h() aplikasi; tanpa innerHTML. */
  function dom(md, h) {
    const inl = (rs) => rs.map((r) => { let n = r.t; if (r.c) n = h('code', {}, n); if (r.i) n = h('em', {}, n); if (r.b) n = h('strong', {}, n); return n; });
    const withBr = (ls) => ls.flatMap((l, k) => (k ? [h('br'), ...inl(l)] : inl(l)));
    return parse(md).map((b) => {
      switch (b.t) {
        case 'h': return h('h' + Math.min(4, b.n + 2), { class: 'md-h' }, inl(b.runs));
        case 'p': return h('p', {}, withBr(b.lines));
        case 'quote': return h('blockquote', {}, withBr(b.lines));
        case 'ul': return h('ul', {}, b.items.map((x) => h('li', { class: 'l' + x.level }, inl(x.runs))));
        case 'ol': return h('ol', {}, b.items.map((x, k) => h('li', { class: 'l' + x.level, value: String(x.no || k + 1) }, inl(x.runs))));
        case 'table': { const num = b.head.map((_, k) => b.rows.length > 0 && b.rows.every((r) => angka(r[k] || []) || !plainRuns(r[k] || []).trim()));
          return h('div', { class: 'md-table' }, h('table', {}, h('thead', {}, h('tr', {}, b.head.map((c, k) => h('th', num[k] ? { class: 'r' } : {}, inl(c))))), h('tbody', {}, b.rows.map((r) => h('tr', {}, b.head.map((_, k) => h('td', angka(r[k] || []) ? { class: 'r' } : {}, inl(r[k] || []))))))));
        }
        case 'hr': return h('hr');
        case 'code': return h('pre', {}, b.text);
        default: return null;
      }
    }).filter(Boolean);
  }

  return { parse, runs, plain, html, dom, esc, angka };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Md;
