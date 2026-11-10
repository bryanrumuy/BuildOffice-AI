'use strict';
/** Panggilan AI (Anthropic atau OpenAI) dan pencatatan token bulanan. */
const { readJson, writeJson } = require('./store');

const KEYS = { anthropic: process.env.ANTHROPIC_API_KEY || '', openai: process.env.OPENAI_API_KEY || '' };
const MODELS = { anthropic: process.env.CLAUDE_MODEL || 'claude-haiku-4-5', openai: process.env.OPENAI_MODEL || 'gpt-6-luna' };
const BASES = { anthropic: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com', openai: process.env.OPENAI_BASE_URL || 'https://api.openai.com' };
// Model OpenAI "reasoning" (mis. gpt-6-luna) memakai token berpikir yang ikut menghabiskan batas keluaran, jadi dimatikan untuk ekstraksi.
// Model non-reasoning menolak parameter ini, makanya hanya dikirim jika diisi atau modelnya gpt-6*. OPENAI_REASONING_EFFORT="" = jangan kirim.
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT !== undefined ? process.env.OPENAI_REASONING_EFFORT : (/^gpt-6/.test(MODELS.openai) ? 'none' : '');
// Jika model utama tidak menerima PDF, isi OPENAI_PDF_MODEL dengan model lain yang menerimanya (dipakai hanya untuk dokumen PDF).
const OPENAI_PDF_MODEL = process.env.OPENAI_PDF_MODEL || '';
const MONTHLY_TOKEN_LIMIT = Number(process.env.MONTHLY_TOKEN_LIMIT || 2000000);

function pickProvider() {
  const want = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (!want) return KEYS.anthropic ? 'anthropic' : KEYS.openai ? 'openai' : '';
  if (!(want in KEYS)) { console.log('[!] AI_PROVIDER="' + want + '" tidak dikenal (pilih: anthropic | openai). Jalan di mode demo.'); return ''; }
  if (!KEYS[want]) { console.log('[!] AI_PROVIDER=' + want + ' tapi kunci API-nya belum di-set. Jalan di mode demo.'); return ''; }
  return want;
}
const PROVIDER = pickProvider(); // '' = mode demo
const MODEL = PROVIDER ? MODELS[PROVIDER] : '';

// ---------- Anggaran token ----------
let usage = readJson('usage.json', {});
const monthKey = () => new Date().toISOString().slice(0, 7);
function tokensUsed() { return usage[monthKey()] || 0; }
function addUsage(u) {
  if (!u) return;
  usage[monthKey()] = tokensUsed() + (u.input_tokens || 0) + (u.output_tokens || 0);
  writeJson('usage.json', usage);
}

// Isi pesan ditulis netral: { kind: 'pdf'|'image', mime, b64 } atau { kind: 'text', text }.
const anthropicBlock = (b) => b.kind === 'text' ? { type: 'text', text: b.text }
  : { type: b.kind === 'pdf' ? 'document' : 'image', source: { type: 'base64', media_type: b.mime, data: b.b64 } };
const openaiBlock = (b) => b.kind === 'text' ? { type: 'text', text: b.text }
  : b.kind === 'pdf' ? { type: 'file', file: { filename: 'dokumen.pdf', file_data: 'data:application/pdf;base64,' + b.b64 } }
  : { type: 'image_url', image_url: { url: 'data:' + b.mime + ';base64,' + b.b64 } };

function buildRequest(system, blocks, maxTokens) {
  if (PROVIDER === 'openai') {
    const usePdfModel = OPENAI_PDF_MODEL && blocks.some((b) => b.kind === 'pdf');
    const body = { model: usePdfModel ? OPENAI_PDF_MODEL : MODEL, max_completion_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: blocks.map(openaiBlock) }] };
    if (REASONING_EFFORT && !usePdfModel) body.reasoning_effort = REASONING_EFFORT;
    return { url: BASES.openai + '/v1/chat/completions', headers: { authorization: 'Bearer ' + KEYS.openai }, body };
  }
  return {
    url: BASES.anthropic + '/v1/messages',
    headers: { 'x-api-key': KEYS.anthropic, 'anthropic-version': '2023-06-01' },
    body: { model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: blocks.map(anthropicBlock) }] },
  };
}
function readReply(body) {
  if (PROVIDER === 'openai') {
    const u = body.usage || {};
    addUsage({ input_tokens: u.prompt_tokens || u.input_tokens, output_tokens: u.completion_tokens || u.output_tokens });
    const msg = body.choices && body.choices[0] && body.choices[0].message;
    return (msg && msg.content) || '';
  }
  addUsage(body.usage);
  return (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}
/** fetch ke penyedia AI dengan pesan galat yang bisa dipahami (bukan "The operation was aborted due to timeout"). */
async function fetchAI(url, init, batasMs) {
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(batasMs) }); }
  catch (e) {
    if (e.name === 'TimeoutError') throw new Error(`Penyedia AI terlalu lama menjawab (batas ${Math.round(batasMs / 1000)} detik). Coba lagi, atau pakai pertanyaan yang lebih singkat.`);
    throw new Error('Tidak bisa menghubungi penyedia AI (' + ((e.cause && (e.cause.code || e.cause.message)) || e.message) + '). Periksa koneksi internet.');
  }
}
async function callAI({ system, blocks, maxTokens = 1024 }) {
  if (tokensUsed() >= MONTHLY_TOKEN_LIMIT) throw new Error('Batas token bulanan tercapai (MONTHLY_TOKEN_LIMIT).');
  const req = buildRequest(system, blocks, maxTokens);
  const res = await fetchAI(req.url, { method: 'POST', headers: { 'content-type': 'application/json', ...req.headers }, body: JSON.stringify(req.body) }, 90000);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('API error ' + res.status + ': ' + (body.error && body.error.message || 'tidak diketahui'));
  return readReply(body);
}

/**
 * Agen berkemampuan alat: model boleh memanggil alat (fungsi) berulang kali sebelum memberi jawaban akhir.
 * tools: [{ name, description, parameters (JSON schema) }]; exec(name, args) -> string. Hasil alat dipotong MAX_TOOL_RESULT.
 * Mengembalikan { text, langkah, terpotong }. Token dihitung di tiap putaran dan batas bulanan dicek sebelum tiap putaran.
 */
const MAX_TOOL_RESULT = 12000;
// Agen berlangkah banyak lebih tepat dengan sedikit "berpikir". Bila model menolak parameternya, otomatis dimatikan. OPENAI_AGENT_REASONING="" = jangan kirim.
let agenReasoning = process.env.OPENAI_AGENT_REASONING !== undefined ? process.env.OPENAI_AGENT_REASONING : (/^gpt-6/.test(MODELS.openai) ? 'low' : '');
async function postJson(req) {
  const res = await fetchAI(req.url, { method: 'POST', headers: { 'content-type': 'application/json', ...req.headers }, body: JSON.stringify(req.body) }, 120000);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('API error ' + res.status + ': ' + (body.error && body.error.message || 'tidak diketahui'));
  return body;
}
async function runAgent({ system, blocks, tools, exec, maxSteps = 10, maxTokens = 2500 }) {
  if (!PROVIDER) throw new Error('Mode demo: butuh kunci API.');
  const oa = PROVIDER === 'openai';
  const defs = tools.map((t) => (oa ? { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } } : { name: t.name, description: t.description, input_schema: t.parameters }));
  const messages = oa ? [{ role: 'system', content: system }, { role: 'user', content: blocks.map(openaiBlock) }] : [{ role: 'user', content: blocks.map(anthropicBlock) }];
  let langkah = 0;
  for (;;) {
    if (tokensUsed() >= MONTHLY_TOKEN_LIMIT) throw new Error('Batas token bulanan tercapai (MONTHLY_TOKEN_LIMIT).');
    let text, calls;
    if (oa) {
      const body = { model: MODEL, max_completion_tokens: maxTokens, messages, tools: defs };
      if (agenReasoning) body.reasoning_effort = agenReasoning;
      const kirim = () => postJson({ url: BASES.openai + '/v1/chat/completions', headers: { authorization: 'Bearer ' + KEYS.openai }, body });
      let r;
      // Ditolak 400 saat parameter penalaran dikirim (pesan galat tiap model berbeda): turun ke nilai yang terbukti jalan
      // (REASONING_EFFORT, mis. "none"), lalu tanpa parameter. Yang berhasil diingat agar tidak boros panggilan.
      for (let turun = 0; ; turun++) {
        try { r = await kirim(); break; } catch (e) {
          if (!body.reasoning_effort || !/API error 400/.test(e.message) || turun >= 2) throw e;
          agenReasoning = turun === 0 && REASONING_EFFORT && REASONING_EFFORT !== body.reasoning_effort ? REASONING_EFFORT : '';
          if (agenReasoning) body.reasoning_effort = agenReasoning; else delete body.reasoning_effort;
        }
      }
      const u = r.usage || {}; addUsage({ input_tokens: u.prompt_tokens || u.input_tokens, output_tokens: u.completion_tokens || u.output_tokens });
      const msg = (r.choices && r.choices[0] && r.choices[0].message) || {};
      text = msg.content || ''; calls = (msg.tool_calls || []).map((c) => ({ id: c.id, name: c.function && c.function.name, raw: c.function && c.function.arguments }));
      if (calls.length && langkah < maxSteps) messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
    } else {
      const r = await postJson({ url: BASES.anthropic + '/v1/messages', headers: { 'x-api-key': KEYS.anthropic, 'anthropic-version': '2023-06-01' }, body: { model: MODEL, max_tokens: maxTokens, system, messages, tools: defs } });
      addUsage(r.usage);
      const blocksOut = r.content || [];
      text = blocksOut.filter((b) => b.type === 'text').map((b) => b.text).join(''); calls = blocksOut.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input }));
      if (calls.length && langkah < maxSteps) messages.push({ role: 'assistant', content: blocksOut });
    }
    if (!calls.length) return { text, langkah, terpotong: false };
    if (langkah >= maxSteps) return { text, langkah, terpotong: true };
    langkah++;
    const results = [];
    for (const c of calls) {
      let args = c.input;
      if (args === undefined) { try { args = JSON.parse(c.raw || '{}'); } catch { args = null; } }
      let out;
      try { out = args && typeof args === 'object' ? await exec(c.name, args) : 'GALAT: argumen alat bukan JSON yang valid.'; } catch (e) { out = 'GALAT: ' + String(e.message || e); }
      results.push({ id: c.id, out: String(out).slice(0, MAX_TOOL_RESULT) });
    }
    if (oa) for (const r of results) messages.push({ role: 'tool', tool_call_id: r.id, content: r.out });
    else messages.push({ role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.out })) });
  }
}

module.exports = { PROVIDER, MODEL, MONTHLY_TOKEN_LIMIT, tokensUsed, callAI, runAgent };
