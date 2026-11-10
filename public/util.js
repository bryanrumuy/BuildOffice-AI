'use strict';
/** Pembantu umum: DOM aman (tanpa innerHTML), panggilan API, format angka/tanggal, toast, dan dialog form. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'value') continue; // diset setelah anak ditambahkan (penting untuk <select>)
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  if (props && 'value' in props) e.value = props.value == null ? '' : props.value;
  return e;
}

/** Elemen SVG (untuk grafik), tanpa innerHTML. */
function svg(tag, attrs, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) e.setAttribute(k, v);
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, {
    credentials: 'same-origin', ...opts,
    headers: opts.body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Belum login'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal (' + res.status + ')');
  return data;
}

const rp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (d) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const daysUntil = (d) => Math.round((Date.parse(d) - Date.parse(today())) / 86400000);
const sisaText = (n) => (n < 0 ? `Lewat ${-n} hari` : n === 0 ? 'Hari ini' : `${n} hari lagi`);
const sisaClass = (n) => (n < 0 ? 'late' : n <= 14 ? 'soon' : 'ok');
const errText = (e) => (e && e.message) || String(e);

function toast(msg, kind = 'ok') {
  const t = h('div', { class: 'toast ' + (kind === 'ok' ? '' : kind), role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const optionOf = (o) => (typeof o === 'string' ? h('option', { value: o }, o) : h('option', { value: o.value }, o.label));

/** Dialog form umum. fields: [{ key, label, type: text|number|date|select|textarea, options, wide, placeholder }] */
function openForm({ title, fields, values = {}, submitLabel = 'Simpan', onSubmit, note }) {
  const dlg = $('#dlg'), form = $('#dlgForm');
  form.replaceChildren();
  const inputs = {}, err = h('div', { class: 'err', role: 'alert' });
  const grid = h('div', { class: 'fields' });
  for (const f of fields) {
    const v = values[f.key] == null ? (f.default == null ? '' : f.default) : values[f.key];
    const el = f.type === 'select' ? h('select', { value: v }, f.options.map(optionOf))
      : f.type === 'textarea' ? h('textarea', { value: v })
      : h('input', { type: f.type || 'text', value: v, placeholder: f.placeholder, inputmode: f.inputmode });
    inputs[f.key] = el;
    grid.append(h('label', { class: 'f' + (f.wide ? ' wide' : '') }, f.label, el));
  }
  const submit = h('button', { class: 'btn primary', type: 'submit' }, submitLabel);
  form.append(...[h('h3', {}, title), note ? h('div', { class: 'muted' }, note) : null, grid, err,
    h('div', { class: 'row' }, submit, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Batal'))].filter(Boolean));
  form.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = ''; submit.disabled = true;
    try {
      const vals = {}; for (const k in inputs) vals[k] = inputs[k].value;
      await onSubmit(vals); dlg.close();
    } catch (ex) { err.textContent = errText(ex); } finally { submit.disabled = false; }
  };
  dlg.showModal();
  const first = form.querySelector('input,select,textarea'); if (first) first.focus();
}
