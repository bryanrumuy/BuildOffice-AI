'use strict';
/**
 * Denah kantor (9 ruangan) + pencari jalan A* agar agen berjalan tanpa menembus dinding, meja, atau perabot.
 * Satu sumber kebenaran: office.js menggambar dari data ini, dan peta halangan dibangun dari data yang sama.
 * Bisa dimuat di browser (global Pathing) maupun Node (untuk uji).
 */
const Pathing = (() => {
  const W = 480, H = 320, CELL = 4, INFLATE = 3, COLS = W / CELL, ROWS = H / CELL;
  const SIZES = { bookshelf: [26, 22], cabinet: [16, 24], safe: [18, 22], plant: [12, 15], coffee: [12, 10], printer: [14, 14], fridge: [14, 26], counter: [14, 8],
    table: [32, 10], sofa: [32, 22], tv: [30, 10], meeting: [44, 26], longtable: [72, 28], couch: [30, 18], rack: [14, 24], tree: [22, 30], pond: [44, 20], box: [14, 12], readtable: [40, 10], bench: [30, 10] };
  // [jenis, x, y]. Perabot dinding hanya di satu sisi tiap ruangan supaya selalu ada jalan keluar dari kursi.
  const LAYOUT = [
    // baris atas
    ['bookshelf', 12, 29], ['plant', 14, 88], ['cabinet', 102, 29], ['cabinet', 118, 29], ['safe', 190, 30], ['couch', 292, 84], ['plant', 336, 29],
    // baris tengah
    ['cabinet', 10, 128], ['plant', 14, 208], ['plant', 78, 208], ['plant', 100, 208], ['printer', 246, 126], ['plant', 190, 208], ['plant', 256, 208],
    ['fridge', 276, 126], ['coffee', 326, 126], ['counter', 338, 126], ['table', 296, 148], // lorong pintu x 296..320 dibiarkan kosong
    ['sofa', 296, 188], ['tv', 300, 218], ['plant', 338, 178], ['plant', 338, 214],
    // sayap kanan: Ruang Server dan Ruang Rapat (meja panjang di tengah; lorong pintu x 404..428 dibiarkan kosong)
    ['cabinet', 360, 29], ['rack', 424, 29], ['rack', 440, 29], ['rack', 456, 29], ['plant', 456, 92],
    ['longtable', 377, 164], ['plant', 358, 128], ['plant', 456, 128], ['plant', 358, 214], ['plant', 456, 214],
    // baris bawah: Perpustakaan, Gudang Arsip, Taman Belakang (lorong pintu x 40..64, 160..184, 276..300, 404..428 dibiarkan kosong)
    ['bookshelf', 12, 248], ['bookshelf', 68, 248], ['bookshelf', 96, 248], ['readtable', 44, 284],
    ['cabinet', 134, 248], ['cabinet', 150, 248], ['cabinet', 188, 248], ['box', 138, 294], ['box', 154, 298], ['box', 180, 292],
    ['tree', 214, 250], ['tree', 240, 250], ['tree', 330, 250], ['tree', 356, 250], ['tree', 440, 250], ['pond', 330, 284], ['bench', 250, 288]];
  // [dx, dy, lebar meja, (opsional) titik berdiri tamu x, y]. Meja baris kedua dan meja Manajer memakai titik tamu sendiri karena bagian depannya tertutup dinding atau meja rapat.
  const SEATS = { pembaca: [30, 66, 44], arsip: [118, 66, 44], keuangan: [206, 66, 44], pengingat: [30, 150, 44], penerima: [114, 150, 52], pelapor: [206, 150, 44],
    manajer: [282, 48, 44, 304, 70], asisten: [118, 206, 44, 162, 186], penjaga: [366, 66, 44], pelaksana: [210, 206, 44, 250, 186] };
  const SEAT_ORDER = ['pembaca', 'arsip', 'keuangan', 'pengingat', 'penerima', 'pelapor', 'manajer', 'asisten', 'penjaga', 'pelaksana'];
  const ROOMS = [
    { id: 'baca', nama: 'Ruang Baca', x: 8, y: 26, w: 88, h: 84 }, { id: 'arsip', nama: 'Arsip', x: 96, y: 26, w: 88, h: 84 },
    { id: 'keuangan', nama: 'Keuangan', x: 184, y: 26, w: 88, h: 84 }, { id: 'manajer', nama: 'Ruang Manajer', x: 272, y: 26, w: 80, h: 84 },
    { id: 'pengingat', nama: 'Pengingat', x: 8, y: 124, w: 88, h: 108 }, { id: 'lobi', nama: 'Lobi', x: 96, y: 124, w: 88, h: 108 },
    { id: 'pelapor', nama: 'Pelapor', x: 184, y: 124, w: 88, h: 108 }, { id: 'pantry', nama: 'Pantry & Makan', x: 272, y: 124, w: 80, h: 48 },
    { id: 'santai', nama: 'Ruang Santai', x: 272, y: 174, w: 80, h: 58 },
    { id: 'server', nama: 'Ruang Server', x: 354, y: 26, w: 118, h: 84 }, { id: 'rapat', nama: 'Ruang Rapat', x: 354, y: 124, w: 118, h: 108 },
    { id: 'perpus', nama: 'Perpustakaan', x: 8, y: 246, w: 120, h: 66 }, { id: 'gudang', nama: 'Gudang Arsip', x: 128, y: 246, w: 80, h: 66 },
    { id: 'taman', nama: 'Taman Belakang', x: 208, y: 246, w: 264, h: 66 }];
  const WALLS = [[0, 0, 480, 28], [0, 0, 8, 320], [472, 0, 8, 320], [0, 312, 480, 8],
    // pembatas baris atas/tengah (celah = pintu) dan tengah/bawah
    [8, 110, 32, 14], [64, 110, 64, 14], [152, 110, 64, 14], [240, 110, 56, 14], [320, 110, 84, 14], [428, 110, 44, 14],
    [8, 232, 32, 14], [64, 232, 96, 14], [184, 232, 92, 14], [300, 232, 104, 14], [428, 232, 44, 14],
    ...[96, 184, 272].flatMap((x) => [[x - 1, 26, 3, 54], [x - 1, 104, 3, 6], [x - 1, 124, 3, 56], [x - 1, 204, 3, 28]]), // sekat tegak (celah = pintu)
    [351, 26, 3, 54], [351, 104, 3, 6], [351, 124, 3, 70], [351, 214, 3, 18], // sekat gedung lama | sayap kanan; pintu: Ruang Manajer -> Ruang Server (y80..104) dan Ruang Santai -> Ruang Rapat (y194..214)
    [272, 171, 24, 3], [320, 171, 32, 3], // pantry | santai
    ...[128, 208].flatMap((x) => [[x - 1, 246, 3, 22], [x - 1, 292, 3, 20]])]; // sekat Perpustakaan | Gudang | Taman
  const STAND = { coffee: [332, 142], whiteboard: [88, 131], printer: [236, 132], lobi: [140, 176], jendela1: [60, 38], jendela2: [150, 38], jendela3: [236, 38], jendela4: [320, 40], jendela5: [392, 38],
    manajerlewat: [340, 50], sofamanajer: [305, 106],
    // titik berdiri saat rapat: lima di sisi atas dan lima di sisi bawah meja panjang Ruang Rapat
    kursi1: [383, 158], kursi2: [395, 158], kursi3: [407, 158], kursi4: [419, 158], kursi5: [431, 158], kursi6: [383, 198], kursi7: [395, 198], kursi8: [407, 198], kursi9: [419, 198], kursi10: [431, 198],
    server: [440, 62], ruangrapat: [462, 178], perpus: [100, 278], gudang: [172, 284], kolam: [352, 276], taman: [300, 272] };
  const SIT = { makan1: [301, 137], makan2: [315, 137], santai1: [299, 190], santai2: [313, 190], // pojok kiri-atas orang yang duduk
    baca1: [49, 273], baca2: [67, 273], taman1: [255, 277], taman2: [269, 277] };

  const rects = [...WALLS, ...Object.values(SEATS).map(([dx, dy, w]) => [dx, dy - 9, w, 25]), ...LAYOUT.map(([k, x, y]) => [x, y, SIZES[k][0], SIZES[k][1]])];
  const blocked = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
    blocked[r * COLS + c] = rects.some(([x, y, w, h]) => cx > x - INFLATE && cx < x + w + INFLATE && cy > y - INFLATE && cy < y + h + INFLATE) ? 1 : 0;
  }
  const col = (x) => Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL))), row = (y) => Math.min(ROWS - 1, Math.max(0, Math.floor(y / CELL)));
  const isFreeCell = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked[r * COLS + c];
  const center = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  const isFree = (x, y) => isFreeCell(col(x), row(y));

  /** Sel bebas terdekat dari titik (x, y); null jika tidak ada dalam radius. */
  function nearestFree(x, y, radius = 10) {
    const c0 = col(x), r0 = row(y);
    let best = null, bestD = Infinity;
    for (let r = r0 - radius; r <= r0 + radius; r++) for (let c = c0 - radius; c <= c0 + radius; c++) {
      if (!isFreeCell(c, r)) continue;
      const p = center(c, r), d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  function lineFree(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!isFree(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
    return true;
  }
  /** A* 8 arah tanpa memotong sudut. Hasil: daftar titik tujuan (tanpa titik awal), sudah diluruskan; null jika tak terjangkau. */
  function find(from, to) {
    const s = nearestFree(from.x, from.y), g = nearestFree(to.x, to.y);
    if (!s || !g) return null;
    const sc = col(s.x), sr = row(s.y), gc = col(g.x), gr = row(g.y), idx = (c, r) => r * COLS + c;
    const gScore = new Map([[idx(sc, sr), 0]]), came = new Map(), open = [[0, sc, sr]], closed = new Set();
    const h = (c, r) => { const dx = Math.abs(c - gc), dy = Math.abs(r - gr); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [, c, r] = open.shift(), k = idx(c, r);
      if (closed.has(k)) continue; closed.add(k);
      if (c === gc && r === gr) {
        const pts = [center(c, r)]; let cur = k;
        while (came.has(cur)) { cur = came.get(cur); pts.push(center(cur % COLS, Math.floor(cur / COLS))); }
        pts.reverse();
        const out = []; let i = 0;
        while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !lineFree(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
        return out;
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (!isFreeCell(nc, nr) || (dc && dr && (!isFreeCell(c + dc, r) || !isFreeCell(c, r + dr)))) continue;
        const ng = gScore.get(k) + (dc && dr ? Math.SQRT2 : 1), nk = idx(nc, nr);
        if (ng < (gScore.has(nk) ? gScore.get(nk) : Infinity)) { gScore.set(nk, ng); came.set(nk, k); open.push([ng + h(nc, nr), nc, nr]); }
      }
    }
    return null;
  }

  const seatCenterX = (id) => SEATS[id][0] + (SEATS[id][2] - 10) / 2 + 5;
  const stand = (id) => nearestFree(seatCenterX(id), SEATS[id][1] - 13); // berdiri di belakang meja sendiri (tempat bangkit dari kursi)
  const front = (id) => (SEATS[id][3] == null ? nearestFree(seatCenterX(id), SEATS[id][1] + 24) : nearestFree(SEATS[id][3], SEATS[id][4])); // berdiri di depan meja rekan (untuk mengobrol)
  const spot = (name) => nearestFree(STAND[name][0], STAND[name][1]);
  const sitApproach = (name) => nearestFree(SIT[name][0] + 5, SIT[name][1] + 14); // titik bebas terdekat, lalu melangkah lurus ke tempat duduk

  return { W, H, CELL, SIZES, LAYOUT, SEATS, SEAT_ORDER, ROOMS, WALLS, STAND, SIT, find, nearestFree, isFree, stand, front, spot, sitApproach, seatCenterX };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Pathing;
