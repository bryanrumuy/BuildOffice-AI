'use strict';
/** Avatar agen: tiap agen punya model rambut, warna kulit/baju, dan aksesori sendiri. Digambar dari kotak piksel. */
const Avatars = (() => {
  const LOOKS = {
    penerima: { skin: '#e2b48a', hair: '#2b1b12', style: 'bun', shirt: '#c0392b', pants: '#2c2c3e', acc: 'lanyard' },
    pembaca: { skin: '#f0c8a0', hair: '#3b2a1a', style: 'short', shirt: '#3a7bd5', pants: '#2b3a55', acc: 'glasses' },
    arsip: { skin: '#b97a50', hair: '#2a1c12', style: 'curly', shirt: '#7d4fc4', pants: '#35353f', acc: 'tie' },
    keuangan: { skin: '#d9a982', hair: '#1f6b46', style: 'cap', shirt: '#2e9e6b', pants: '#33382f', acc: 'beard' },
    pengingat: { skin: '#c68e63', hair: '#161616', style: 'long', shirt: '#e0833a', pants: '#3a2f2a', acc: 'headband' },
    pelapor: { skin: '#f0c8a0', hair: '#5b3a8a', style: 'side', shirt: '#c24f9b', pants: '#2f2f46', acc: 'headset' },
    manajer: { skin: '#d4a373', hair: '#c9ccd6', style: 'short', shirt: '#1f3b5c', pants: '#22222e', acc: 'tie2' },
    asisten: { skin: '#f5d0b0', hair: '#c98a3a', style: 'pony', shirt: '#2aa5b3', pants: '#2f3b4a', acc: 'bow' },
    penjaga: { skin: '#8d5a3b', hair: '#111111', style: 'buzz', shirt: '#4a4f5c', pants: '#1d1d26', acc: 'badge' },
    pelaksana: { skin: '#e8b98f', hair: '#d9772b', style: 'short', shirt: '#e5c64a', pants: '#4a3b2a', acc: 'vest' },
  };
  const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  function hair(ctx, x, y, k) {
    const h = k.hair;
    switch (k.style) {
      case 'long': R(ctx, x + 1, y, 8, 3, h); R(ctx, x, y + 1, 2, 9, h); R(ctx, x + 8, y + 1, 2, 9, h); break;
      case 'bun': R(ctx, x + 1, y, 8, 3, h); R(ctx, x, y + 1, 1, 3, h); R(ctx, x + 9, y + 1, 1, 3, h); R(ctx, x + 3, y - 1, 5, 1, h); R(ctx, x + 4, y - 2, 3, 1, h); break;
      case 'curly': R(ctx, x, y - 1, 10, 4, h); R(ctx, x, y + 3, 1, 2, h); R(ctx, x + 9, y + 3, 1, 2, h); R(ctx, x + 2, y - 2, 6, 1, h); break;
      case 'cap': R(ctx, x + 1, y, 8, 3, h); R(ctx, x + 2, y + 3, 8, 1, 'rgba(0,0,0,.45)'); R(ctx, x + 2, y + 3, 8, 1, h); R(ctx, x, y + 1, 1, 2, k.skin); break;
      case 'side': R(ctx, x + 1, y, 8, 3, h); R(ctx, x + 1, y + 3, 3, 1, h); R(ctx, x, y + 1, 1, 6, h); R(ctx, x + 9, y + 1, 1, 3, h); break;
      case 'pony': R(ctx, x + 1, y, 8, 3, h); R(ctx, x, y + 1, 1, 3, h); R(ctx, x + 9, y + 1, 2, 3, h); R(ctx, x + 10, y + 4, 2, 5, h); break; // ekor kuda di kanan
      case 'buzz': R(ctx, x + 1, y, 8, 2, h); R(ctx, x, y + 1, 1, 2, h); R(ctx, x + 9, y + 1, 1, 2, h); break;
      default: R(ctx, x + 1, y, 8, 3, h); R(ctx, x, y + 1, 1, 3, h); R(ctx, x + 9, y + 1, 1, 3, h); // short
    }
  }
  function headAcc(ctx, x, y, k) {
    switch (k.acc) {
      case 'glasses': for (const gx of [x + 2, x + 5]) { R(ctx, gx, y + 3, 3, 1, '#1a1a1a'); R(ctx, gx, y + 5, 3, 1, '#1a1a1a'); R(ctx, gx, y + 4, 1, 1, '#1a1a1a'); R(ctx, gx + 2, y + 4, 1, 1, '#1a1a1a'); } break;
      case 'beard': R(ctx, x + 1, y + 5, 1, 2, k.hair); R(ctx, x + 8, y + 5, 1, 2, k.hair); R(ctx, x + 2, y + 7, 6, 1, k.hair); break;
      case 'headband': R(ctx, x + 1, y + 2, 8, 1, '#f2c14e'); break;
      case 'bow': R(ctx, x + 7, y, 3, 2, '#e84a7f'); R(ctx, x + 8, y + 1, 1, 1, '#ffd0e0'); break;
      case 'headset': R(ctx, x, y + 2, 1, 4, '#222'); R(ctx, x + 9, y + 2, 1, 4, '#222'); R(ctx, x + 1, y, 8, 1, '#222'); R(ctx, x + 8, y + 5, 2, 1, '#222'); break;
      default:
    }
  }
  function bodyAcc(ctx, x, y, k) { // y = puncak badan
    if (k.acc === 'tie') { R(ctx, x + 4, y, 2, 6, '#2a1f45'); R(ctx, x + 4, y, 2, 1, '#e8e8ee'); }
    if (k.acc === 'tie2') { R(ctx, x + 3, y, 4, 1, '#e8e8ee'); R(ctx, x + 4, y + 1, 2, 5, '#c0392b'); }
    if (k.acc === 'badge') { R(ctx, x + 6, y + 1, 2, 2, '#f2c14e'); R(ctx, x + 6, y + 3, 2, 1, '#fff'); }
    if (k.acc === 'vest') { R(ctx, x + 1, y, 2, 6, '#c9a62f'); R(ctx, x + 7, y, 2, 6, '#c9a62f'); R(ctx, x + 4, y + 2, 2, 1, '#fff6c8'); }
    if (k.acc === 'lanyard') { R(ctx, x + 3, y, 1, 5, '#e8e8ee'); R(ctx, x + 6, y, 1, 5, '#e8e8ee'); R(ctx, x + 4, y + 4, 3, 3, '#fff'); R(ctx, x + 5, y + 5, 1, 1, '#c0392b'); }
  }
  function head(ctx, x, y, k, st) {
    R(ctx, x + 1, y, 8, 7, k.skin);
    hair(ctx, x, y, k);
    if (st === 'idle') { R(ctx, x + 3, y + 4, 2, 1, '#222'); R(ctx, x + 6, y + 4, 2, 1, '#222'); } // mata terpejam
    else { R(ctx, x + 3, y + 4, 1, 1, '#222'); R(ctx, x + 6, y + 4, 1, 1, '#222'); }
    if (st === 'done' || st === 'happy') R(ctx, x + 4, y + 6, 3, 1, '#a0442b');
    headAcc(ctx, x, y, k);
  }

  /** Duduk (setengah badan). (x, y) = pojok kiri-atas kepala. opts.chair: gambar sandaran kursi. */
  function seated(ctx, x, y, k, st, frame, opts = {}) {
    const t = (frame >> 1) % 2;
    if (opts.chair !== false) { R(ctx, x - 1, y + 6, 12, 9, '#2f7d4a'); R(ctx, x - 1, y + 6, 12, 2, '#3a9a5c'); }
    R(ctx, x + 1, y + 7, 8, 7, k.shirt); R(ctx, x + 1, y + 12, 8, 2, 'rgba(0,0,0,.18)');
    R(ctx, x - 1, y + 8, 2, 4, k.shirt); R(ctx, x + 9, y + 8, 2, 4, k.shirt);
    bodyAcc(ctx, x, y + 7, k);
    head(ctx, x, y, k, st);
    if (st === 'done') { R(ctx, x + 10, y + 2 + (t ? 0 : 1), 2, 6, k.shirt); R(ctx, x + 10, y + (t ? 0 : 1), 2, 2, k.skin); } // melambai
  }

  /** Berjalan (badan penuh). (cx, fy) = tengah telapak kaki. Tinggi 17 px. */
  function walker(ctx, cx, fy, k, frame, st) {
    const x = Math.round(cx - 5), y = Math.round(fy - 17), p = (frame >> 1) % 2;
    R(ctx, x + 1, y + 17, 8, 1, 'rgba(0,0,0,.28)'); // bayangan
    R(ctx, x + 2, y + 13, 3, 4 - (p ? 1 : 0), k.pants); R(ctx, x + 5, y + 13, 3, 3 + (p ? 1 : 0), k.pants);
    R(ctx, x + 2, y + 16 - (p ? 1 : 0), 3, 1, '#1a1a1a'); R(ctx, x + 5, y + 16 + (p ? 0 : -1), 3, 1, '#1a1a1a');
    R(ctx, x + 1, y + 7, 8, 6, k.shirt); R(ctx, x + 1, y + 11, 8, 2, 'rgba(0,0,0,.18)');
    R(ctx, x - 1, y + 8 + (p ? 1 : 0), 2, 5, k.shirt); R(ctx, x + 9, y + 8 + (p ? 0 : 1), 2, 5, k.shirt);
    R(ctx, x - 1, y + 12 + (p ? 1 : 0), 2, 1, k.skin); R(ctx, x + 9, y + 12 + (p ? 0 : 1), 2, 1, k.skin);
    bodyAcc(ctx, x, y + 7, k);
    head(ctx, x, y, k, st || 'walk');
  }
  /** Kursi kosong (saat penghuninya sedang pergi). */
  function emptyChair(ctx, x, y) { R(ctx, x - 1, y + 6, 12, 9, '#2f7d4a'); R(ctx, x - 1, y + 6, 12, 2, '#3a9a5c'); }

  return { LOOKS, seated, walker, emptyChair };
})();
