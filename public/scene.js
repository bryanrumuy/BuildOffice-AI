'use strict';
/** Latar kantor: lantai 9 ruangan, dinding, jendela, dekorasi, dan perabot. Posisi perabot diambil dari Pathing.LAYOUT. */
const Scene = (() => {
  const { W, H } = Pathing;
  const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const rp = Pathing.ROOMS.reduce((m, r) => { m[r.id] = r; return m; }, {});

  /* ---------- lantai ---------- */
  function plank(ctx, { x, y, w, h }, base = '#8a5a36', line = '#7a4d2d') {
    R(ctx, x, y, w, h, base);
    for (let r = 0, yy = y; yy < y + h; r++, yy += 6) {
      R(ctx, x, yy, w, 1, line);
      for (let xx = x + (r % 2) * 8; xx < x + w; xx += 16) R(ctx, xx, yy, 1, Math.min(6, y + h - yy), line);
    }
  }
  function carpet(ctx, { x, y, w, h }, c1, c2) {
    R(ctx, x, y, w, h, c1);
    for (let yy = y; yy < y + h; yy += 4) for (let xx = x + (((yy - y) / 4) % 2) * 2; xx < x + w; xx += 4) R(ctx, xx, yy, 1, 1, c2);
  }
  function checker(ctx, { x, y, w, h }, c1 = '#dfe3ea', c2 = '#c3c9d4', s = 8) {
    for (let yy = y; yy < y + h; yy += s) for (let xx = x; xx < x + w; xx += s)
      R(ctx, xx, yy, Math.min(s, x + w - xx), Math.min(s, y + h - yy), (((xx - x) / s + (yy - y) / s) % 2) ? c1 : c2);
  }
  function floors(ctx) {
    R(ctx, 0, 0, W, H, '#0f1b2d');
    plank(ctx, { x: 8, y: 106, w: 464, h: 22 }); plank(ctx, { x: 8, y: 228, w: 464, h: 22 }); plank(ctx, { x: 272, y: 168, w: 80, h: 8 }); // ambang pintu
    plank(ctx, rp.baca); carpet(ctx, rp.arsip, '#35557f', '#3e6190'); carpet(ctx, rp.keuangan, '#2f6b57', '#378069');
    carpet(ctx, rp.manajer, '#4a3b30', '#56463a'); R(ctx, 286, 76, 56, 32, '#7d2f2f'); R(ctx, 288, 78, 52, 28, '#963b3b'); // Ruang Manajer: karpet cokelat + permadani merah
    carpet(ctx, rp.pengingat, '#7d4141', '#8a4b4b'); checker(ctx, rp.lobi); R(ctx, 112, 172, 56, 22, '#8c3b3b'); R(ctx, 114, 174, 52, 18, '#a04848');
    carpet(ctx, rp.pelapor, '#5b4a82', '#6a5894');
    checker(ctx, rp.pantry, '#efe6cf', '#d9cfae', 6);
    carpet(ctx, rp.santai, '#2f6b6b', '#377a7a'); R(ctx, 284, 180, 56, 46, '#3a5f8f'); R(ctx, 286, 182, 52, 42, '#4a73a8');
    wingFloors(ctx); bottomFloors(ctx);
  }
  /** Sayap kanan: Ruang Server (ubin gelap + kabel) dan Ruang Tamu (karpet cokelat). */
  function wingFloors(ctx) {
    checker(ctx, rp.server, '#243148', '#1d2840', 8); R(ctx, 354, 56, 118, 2, '#2f6f8f'); R(ctx, 420, 54, 2, 56, '#2f6f8f');
    carpet(ctx, rp.rapat, '#2e4a63', '#385a78'); R(ctx, 366, 146, 94, 64, '#27506b'); R(ctx, 368, 148, 90, 60, '#336485'); // Ruang Rapat: karpet biru + permadani besar
  }
  /** Baris bawah: Perpustakaan (kayu gelap), Gudang Arsip (beton), Taman Belakang (rumput + jalan setapak). */
  function bottomFloors(ctx) {
    plank(ctx, rp.perpus, '#6b4a30', '#5d3f27'); R(ctx, 36, 276, 56, 30, '#3d5a80'); R(ctx, 38, 278, 52, 26, '#4a6a94');
    checker(ctx, rp.gudang, '#7a828e', '#6c7480', 10);
    R(ctx, rp.taman.x, rp.taman.y, rp.taman.w, rp.taman.h, '#3f7f40');
    for (let yy = rp.taman.y; yy < rp.taman.y + rp.taman.h; yy += 6) for (let xx = rp.taman.x + ((yy / 6) % 2) * 3; xx < rp.taman.x + rp.taman.w; xx += 7) R(ctx, xx, yy, 1, 2, '#4d9a4d');
    for (const [px, py, pw, ph] of [[274, 246, 24, 32], [274, 270, 130, 8], [402, 246, 24, 32], [300, 262, 30, 6]]) { R(ctx, px, py, pw, ph, '#c9b48a'); for (let i = 0; i < pw; i += 6) R(ctx, px + i, py, 1, ph, '#b59f75'); } // jalan setapak
    for (const [fx, fy, c] of [[222, 296, '#f2c14e'], [300, 300, '#e84a7f'], [392, 300, '#f2c14e'], [420, 296, '#e84a7f'], [452, 300, '#ffffff'], [470, 280, '#f2c14e']]) { R(ctx, fx, fy, 3, 3, c); R(ctx, fx + 1, fy + 3, 1, 3, '#2e8b4a'); }
  }

  /* ---------- dinding ---------- */
  function wallBand(ctx, x, y, w, h) {
    R(ctx, x, y, w, h, '#2b3e5c'); R(ctx, x, y, w, 2, '#3b5278'); R(ctx, x, y + h - 3, w, 3, '#1a2740');
    for (let xx = x + 6; xx < x + w; xx += 12) R(ctx, xx, y + 3, 1, h - 6, '#26385a');
    R(ctx, x, y + h, w, 2, 'rgba(0,0,0,.28)');
  }
  function windowAt(ctx, x, y, night) {
    R(ctx, x, y, 24, 12, '#cfd8e6'); R(ctx, x + 1, y + 1, 22, 10, night ? '#0b1030' : '#8fd0f2');
    if (night) { R(ctx, x + 4, y + 3, 1, 1, '#fff'); R(ctx, x + 15, y + 7, 1, 1, '#fff'); R(ctx, x + 19, y + 2, 2, 2, '#ffe9a8'); R(ctx, x + 9, y + 8, 1, 1, '#fff'); }
    else { R(ctx, x + 3, y + 2, 8, 3, '#fff'); R(ctx, x + 14, y + 6, 7, 2, '#eaf6ff'); }
    R(ctx, x + 11, y + 1, 2, 10, '#cfd8e6'); R(ctx, x + 1, y + 5, 22, 1, '#cfd8e6');
  }
  function line(ctx, x0, y0, x1, y1, c) {
    ctx.fillStyle = c;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  function clock(ctx, cx, cy) {
    R(ctx, cx - 5, cy - 6, 10, 12, '#e8e8ee'); R(ctx, cx - 6, cy - 5, 12, 10, '#e8e8ee'); R(ctx, cx - 4, cy - 5, 8, 10, '#f8f8fa'); R(ctx, cx - 5, cy - 4, 10, 8, '#f8f8fa');
    const d = new Date(), m = d.getMinutes() / 60 * Math.PI * 2, hr = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2;
    line(ctx, cx, cy, cx + Math.round(Math.sin(m) * 4), cy - Math.round(Math.cos(m) * 4), '#222');
    line(ctx, cx, cy, cx + Math.round(Math.sin(hr) * 2.5), cy - Math.round(Math.cos(hr) * 2.5), '#c0392b');
  }
  const whiteboard = (ctx, x, y) => { R(ctx, x, y, 32, 12, '#8a97a8'); R(ctx, x + 1, y + 1, 30, 10, '#eef2f6'); R(ctx, x + 3, y + 3, 14, 1, '#3a7bd5'); R(ctx, x + 3, y + 6, 20, 1, '#c0392b'); R(ctx, x + 3, y + 8, 9, 1, '#27ae60'); };
  function calendar(ctx, x, y) {
    R(ctx, x, y, 18, 12, '#f5f5f0'); R(ctx, x, y, 18, 3, '#d9453b');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) R(ctx, x + 2 + c * 3, y + 5 + r * 3, 2, 2, '#a9b2bd');
    R(ctx, x + 8, y + 8, 2, 2, '#d9453b');
  }
  const poster = (ctx, x, y) => { R(ctx, x, y, 12, 10, '#6b4a2a'); R(ctx, x + 1, y + 1, 10, 8, '#e9d8a6'); R(ctx, x + 3, y + 3, 6, 4, '#4f8f6a'); R(ctx, x + 5, y + 2, 2, 2, '#f2c14e'); };
  function walls(ctx, night) {
    wallBand(ctx, 8, 8, 464, 18);
    for (const x of [20, 52, 112, 144, 200, 232, 288, 320, 372, 404, 436]) windowAt(ctx, x, 11, night);
    clock(ctx, 180, 17);
    for (const w of Pathing.WALLS) {
      if (w[3] === 14) wallBand(ctx, w[0], w[1], w[2], w[3]); // pembatas atas/bawah
      else if (w[2] === 3) { R(ctx, w[0], w[1], 3, w[3], '#1f3050'); R(ctx, w[0], w[1], 1, w[3], '#2e4670'); } // sekat tegak
      else if (w[3] === 3) { R(ctx, w[0], w[1], w[2], 3, '#1f3050'); R(ctx, w[0], w[1], w[2], 1, '#2e4670'); } // sekat datar
    }
    poster(ctx, 14, 113); whiteboard(ctx, 70, 112); calendar(ctx, 108, 113); poster(ctx, 158, 113); calendar(ctx, 196, 113); whiteboard(ctx, 246, 112); poster(ctx, 326, 113); calendar(ctx, 372, 113); poster(ctx, 440, 113);
    poster(ctx, 20, 235); calendar(ctx, 76, 235); whiteboard(ctx, 196, 234); poster(ctx, 316, 235); calendar(ctx, 360, 235); poster(ctx, 440, 235);
    R(ctx, 0, 0, W, 8, '#1a2740'); R(ctx, 0, 0, 8, H, '#1a2740'); R(ctx, W - 8, 0, 8, H, '#1a2740'); R(ctx, 0, H - 8, W, 8, '#1a2740');
  }

  /* ---------- perabot ---------- */
  const draw = {
    bookshelf(ctx, x, y) {
      R(ctx, x, y, 26, 20, '#5a3d1f'); R(ctx, x + 1, y + 1, 24, 18, '#3b2814');
      const cols = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'];
      for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) R(ctx, x + 2 + i * 3, y + 2 + r * 9 + (i % 3 === 0 ? 1 : 0), 2, 7 - (i % 3 === 0 ? 1 : 0), cols[(i + r * 2) % 6]);
      R(ctx, x, y + 20, 26, 2, 'rgba(0,0,0,.25)');
    },
    cabinet(ctx, x, y) {
      R(ctx, x, y, 16, 22, '#7b8aa3'); R(ctx, x, y, 16, 2, '#9db0cc');
      for (const o of [3, 9, 15]) { R(ctx, x + 1, y + o, 14, 5, '#6a7992'); R(ctx, x + 6, y + o + 2, 4, 1, '#d8dee9'); }
      R(ctx, x, y + 22, 16, 2, 'rgba(0,0,0,.25)');
    },
    safe(ctx, x, y) {
      R(ctx, x, y, 18, 20, '#59606e'); R(ctx, x + 1, y + 1, 16, 18, '#707887'); R(ctx, x + 9, y + 6, 6, 6, '#cfd5df'); R(ctx, x + 11, y + 8, 2, 2, '#3a3f4d'); R(ctx, x + 3, y + 8, 2, 4, '#d9b04a');
      R(ctx, x + 1, y + 20, 3, 2, '#3a3f4d'); R(ctx, x + 14, y + 20, 3, 2, '#3a3f4d');
    },
    plant(ctx, x, y) {
      R(ctx, x + 2, y + 9, 8, 6, '#9a5b32'); R(ctx, x + 2, y + 9, 8, 1, '#b87444');
      R(ctx, x + 5, y, 2, 10, '#2e8b4a'); R(ctx, x + 1, y + 2, 4, 3, '#3aa05a'); R(ctx, x + 7, y + 3, 4, 3, '#3aa05a'); R(ctx, x + 3, y + 5, 3, 3, '#2e8b4a'); R(ctx, x + 6, y + 6, 3, 3, '#2e8b4a');
    },
    coffee(ctx, x, y, f) {
      R(ctx, x, y, 12, 10, '#3a3f4d'); R(ctx, x, y, 12, 2, '#565c70'); R(ctx, x + 2, y + 3, 8, 3, '#1b2030'); R(ctx, x + 4, y + 6, 4, 3, '#fff'); R(ctx, x + 9, y + 2, 2, 1, '#ff5a4a');
      R(ctx, x + 5 + ((f >> 2) % 2), y - 3 - ((f >> 1) % 3), 1, 2, 'rgba(255,255,255,.55)');
    },
    printer(ctx, x, y) { R(ctx, x + 3, y, 8, 4, '#fff'); R(ctx, x, y + 3, 14, 9, '#cfd3d8'); R(ctx, x + 2, y + 5, 10, 2, '#8a8f98'); R(ctx, x + 2, y + 12, 10, 2, '#6a6f78'); },
    fridge(ctx, x, y) {
      R(ctx, x, y, 14, 26, '#d9dde3'); R(ctx, x + 1, y + 1, 12, 11, '#eef0f3'); R(ctx, x + 1, y + 13, 12, 12, '#eef0f3'); R(ctx, x + 11, y + 4, 1, 5, '#8a8f98'); R(ctx, x + 11, y + 16, 1, 5, '#8a8f98');
      R(ctx, x, y + 26, 14, 2, 'rgba(0,0,0,.25)');
    },
    counter(ctx, x, y) { R(ctx, x, y, 14, 8, '#b98a55'); R(ctx, x, y, 14, 2, '#e0b47c'); R(ctx, x + 3, y + 3, 8, 4, '#9aa5b5'); R(ctx, x, y + 8, 14, 2, 'rgba(0,0,0,.25)'); },
    meeting(ctx, x, y) {
      R(ctx, x, y, 44, 26, '#8a5a2e'); R(ctx, x + 1, y + 1, 42, 24, '#b98a55'); R(ctx, x + 1, y + 1, 42, 2, '#d9a96e'); R(ctx, x, y + 26, 44, 2, 'rgba(0,0,0,.25)');
      R(ctx, x + 6, y + 7, 7, 5, '#2b2f3a'); R(ctx, x + 7, y + 8, 5, 3, '#4a90c0'); R(ctx, x + 30, y + 14, 7, 5, '#2b2f3a'); R(ctx, x + 31, y + 15, 5, 3, '#4a90c0'); R(ctx, x + 19, y + 10, 5, 5, '#fff');
      for (let i = 0; i < 4; i++) { R(ctx, x + 4 + i * 10, y - 8, 8, 6, '#3d8f55'); R(ctx, x + 4 + i * 10, y + 28, 8, 6, '#3d8f55'); } // kursi rapat
    },
    couch(ctx, x, y) { R(ctx, x, y, 30, 6, '#4f6fa5'); R(ctx, x + 2, y + 6, 26, 10, '#6a8ac4'); R(ctx, x, y + 4, 3, 12, '#3f5d92'); R(ctx, x + 27, y + 4, 3, 12, '#3f5d92'); R(ctx, x + 15, y + 6, 1, 10, '#4f6fa5'); R(ctx, x, y + 16, 30, 2, 'rgba(0,0,0,.25)'); },
    tv(ctx, x, y, f, on) {
      R(ctx, x, y, 30, 10, '#20242e'); R(ctx, x + 1, y + 1, 28, 7, on ? ((f >> 2) % 2 ? '#7fd0ff' : '#ffd98a') : '#1b2a3a'); R(ctx, x + 12, y + 10, 6, 1, '#20242e');
      if (on) R(ctx, x + 4 + ((f >> 1) % 18), y + 3, 4, 3, 'rgba(255,255,255,.55)');
    },
    sofa(ctx, x, y) { R(ctx, x + 3, y, 26, 10, '#a0524a'); R(ctx, x, y + 2, 3, 20, '#8e433b'); R(ctx, x + 29, y + 2, 3, 20, '#8e433b'); }, // sandaran + lengan (di belakang orang yang duduk)
    table(ctx, x, y) { /* meja makan digambar di foreground() agar menutupi badan bagian bawah orang yang duduk */ },
    readtable() {}, bench() {}, // digambar di foreground()
    longtable(ctx, x, y) { // meja rapat panjang: laptop, kertas, gelas, dan kursi di kedua sisi
      for (let i = 0; i < 5; i++) { const cx = 383 + i * 12 - 5; R(ctx, cx, y - 8, 10, 7, '#3d8f55'); R(ctx, cx, y - 8, 10, 2, '#4fae6b'); R(ctx, cx, y + 29, 10, 7, '#3d8f55'); R(ctx, cx, y + 36, 10, 1, 'rgba(0,0,0,.25)'); }
      R(ctx, x, y, 72, 28, '#7a4a22'); R(ctx, x + 1, y + 1, 70, 26, '#a8733c'); R(ctx, x + 1, y + 1, 70, 3, '#c9955a'); R(ctx, x, y + 28, 72, 3, 'rgba(0,0,0,.28)');
      for (const [px, py] of [[8, 6], [22, 15], [36, 6], [50, 15], [60, 6]]) { R(ctx, x + px, y + py, 7, 5, '#2b2f3a'); R(ctx, x + px + 1, y + py + 1, 5, 3, '#4a90c0'); }
      R(ctx, x + 30, y + 11, 6, 5, '#fff'); R(ctx, x + 66, y + 20, 3, 3, '#e2503a');
    },
    rack(ctx, x, y, f) {
      R(ctx, x, y, 14, 24, '#2b303b'); R(ctx, x + 1, y + 1, 12, 22, '#3a4150');
      for (let i = 0; i < 5; i++) { R(ctx, x + 2, y + 2 + i * 4, 10, 3, '#222833'); R(ctx, x + 3, y + 3 + i * 4, 2, 1, ((f >> 2) + i + x) % 3 ? '#43c17a' : '#f2b84b'); R(ctx, x + 9, y + 3 + i * 4, 2, 1, ((f >> 3) + i) % 4 ? '#5aa9ff' : '#2b303b'); }
      R(ctx, x, y + 24, 14, 2, 'rgba(0,0,0,.25)');
    },
    tree(ctx, x, y) {
      R(ctx, x + 9, y + 20, 4, 10, '#6b4426'); R(ctx, x + 4, y + 28, 14, 2, 'rgba(0,0,0,.25)');
      R(ctx, x + 2, y + 8, 18, 14, '#2f7a3c'); R(ctx, x + 5, y + 2, 12, 10, '#3b8f4a'); R(ctx, x, y + 12, 22, 7, '#2a6b35'); R(ctx, x + 7, y + 4, 4, 3, '#58b062'); R(ctx, x + 13, y + 11, 3, 3, '#58b062');
    },
    pond(ctx, x, y, f) {
      R(ctx, x, y, 44, 20, '#8aa0b5'); R(ctx, x + 2, y + 2, 40, 16, '#2e6f9e'); R(ctx, x + 4, y + 4, 36, 12, '#3a86b8');
      const t = (f >> 2) % 3; R(ctx, x + 8 + t * 2, y + 7, 6, 1, '#8fd0f2'); R(ctx, x + 24 - t * 2, y + 12, 8, 1, '#8fd0f2');
      R(ctx, x + 30, y + 5, 5, 3, '#f28c3a'); R(ctx, x + 35, y + 6, 2, 1, '#f28c3a'); // ikan
      R(ctx, x + 6, y + 11, 4, 3, '#43c17a'); // teratai
    },
    box(ctx, x, y) { R(ctx, x, y, 14, 12, '#b88a55'); R(ctx, x, y, 14, 3, '#d0a66d'); R(ctx, x + 6, y, 2, 12, '#8a6538'); R(ctx, x, y + 12, 14, 2, 'rgba(0,0,0,.25)'); },
  };
  function furniture(ctx, f, sitting = []) {
    const tvOn = sitting.some((n) => n.startsWith('santai'));
    for (const [kind, x, y] of Pathing.LAYOUT) { if (kind === 'tv') draw.tv(ctx, x, y, f, tvOn); else draw[kind](ctx, x, y, f); }
    for (const x of [301, 315]) { R(ctx, x - 1, 143, 12, 9, '#9a6a38'); R(ctx, x - 1, 143, 12, 2, '#b98a55'); } // kursi makan (di belakang orang yang duduk)
    for (const x of [49, 67]) { R(ctx, x - 1, 279, 12, 9, '#9a6a38'); R(ctx, x - 1, 279, 12, 2, '#b98a55'); } // kursi perpustakaan
  }
  /** Digambar SETELAH orang yang duduk: meja makan dan bagian depan sofa menutupi kaki/badan bawah. */
  function foreground(ctx, f, sitting = []) {
    const anyEating = sitting.some((n) => n.startsWith('makan'));
    R(ctx, 296, 148, 32, 10, '#c9985f'); R(ctx, 296, 148, 32, 1, '#e0b47c'); R(ctx, 296, 158, 32, 2, 'rgba(0,0,0,.25)');
    R(ctx, 299, 150, 5, 4, '#fff'); R(ctx, 313, 150, 5, 4, '#fff'); R(ctx, 301, 151, 2, 2, anyEating ? '#e2503a' : '#fff'); R(ctx, 315, 151, 2, 2, anyEating ? '#f2c14e' : '#fff'); R(ctx, 307, 150, 3, 5, '#8fd0f2');
    R(ctx, 299, 202, 26, 8, '#bd6a60'); R(ctx, 299, 202, 26, 1, '#d98a7f'); R(ctx, 312, 202, 1, 8, '#a0524a'); R(ctx, 296, 210, 32, 2, 'rgba(0,0,0,.25)');
    R(ctx, 44, 284, 40, 10, '#c9985f'); R(ctx, 44, 284, 40, 1, '#e0b47c'); R(ctx, 44, 294, 40, 2, 'rgba(0,0,0,.25)'); R(ctx, 50, 286, 7, 4, '#c0392b'); R(ctx, 67, 286, 7, 4, '#3a7bd5'); R(ctx, 59, 285, 5, 3, '#fff'); // meja baca
    R(ctx, 250, 288, 30, 10, '#8a5a2e'); R(ctx, 250, 288, 30, 2, '#b98a55'); R(ctx, 250, 298, 30, 2, 'rgba(0,0,0,.25)'); // bangku taman
  }
  function desk(ctx, s, working, f) {
    const { dx, dy, w } = s;
    R(ctx, dx, dy, w, 5, '#c9985f'); R(ctx, dx, dy, w, 1, '#e0b47c'); R(ctx, dx, dy + 5, w, 8, '#9a6a38'); R(ctx, dx, dy + 13, w, 2, 'rgba(0,0,0,.28)');
    R(ctx, dx + 1, dy + 13, 2, 3, '#5a3d1f'); R(ctx, dx + w - 3, dy + 13, 2, 3, '#5a3d1f');
    for (const mx of [dx + 2, dx + w - 16]) {
      R(ctx, mx, dy - 9, 14, 10, '#2b2f3a'); R(ctx, mx + 1, dy - 8, 12, 7, working ? '#0f3b3b' : '#141c2e'); R(ctx, mx + 5, dy + 1, 4, 1, '#3a3f4d');
      if (working) for (let i = 0; i < 3; i++) R(ctx, mx + 2, dy - 8 + ((f + i * 3) % 7), 3 + ((i * 5 + f) % 7), 1, '#5eead4');
      else R(ctx, mx + 5, dy - 5, 4, 1, '#2a3a5a');
      R(ctx, mx + 12, dy - 1, 1, 1, working ? '#43c17a' : '#c0392b');
    }
  }
  return { floors, walls, furniture, foreground, desk, R };
})();
