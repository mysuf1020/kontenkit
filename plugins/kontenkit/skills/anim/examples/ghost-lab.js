// Lab hantu: satu adegan per hantu/teknik, dirender sebagai gambar diam.
window.STORY = { tag: 'Lab Hantu', scenes: [
 { dur: 2, bg: 'graveyard', tone: 'green', fx: ['fog'], fogAmount: 0.6, caption: '1. Pocong', chars: [{ type: 'pocong', x: 0.6, size: 0.95, still: true }] },
 { dur: 2, bg: 'road', fx: ['fog'], caption: '2. Pocong jauh di kabut', chars: [{ type: 'pocong', x: 0.74, y: 1150, size: 0.38, blur: 3, still: true }, { type: 'person', x: 0.22, accessory: 'lantern', face: 1 }] },
 { dur: 2, bg: 'room', tone: 'purple', caption: '3. Siluet di balik jendela', chars: [{ type: 'pocong', x: 760, y: 990, size: 0.75, silhouette: '#04050a', blur: 2.5, clip: [600, 450, 300, 400], still: true }, { type: 'person', x: 0.3, face: 1, action: 'tremble' }] },
 { dur: 2, bg: 'forest', caption: '4. Kuntilanak di dahan', chars: [{ type: 'ghost', pose: 'perch', x: 0.5, y: 860, size: 0.9 }] },
 { dur: 2, bg: 'corridor', fx: ['flicker'], caption: '5. Kuntilanak membelakangi', chars: [{ type: 'ghost', pose: 'back', x: 0.5, y: 1090, size: 0.42 }] },
 { dur: 2, bg: 'room', tone: 'amber', caption: '6. Bayangan raksasa di dinding', chars: [{ type: 'genderuwo', x: 0.66, size: 0.5, cast: { only: true, sx: 1.8, sy: 1.9, skew: -0.35, dx: 40, dy: -30, alpha: 0.85, blur: 8 } }, { type: 'person', x: 0.3, accessory: 'lantern', face: 1, action: 'tremble' }] },
 { dur: 2, bg: 'forest', tone: 'red', fx: ['fog'], fogAmount: 0.5, caption: '7. Genderuwo', chars: [{ type: 'genderuwo', x: 0.55, size: 0.95 }] },
 { dur: 2, bg: 'house', litWindow: 0, caption: '8. Tuyul', chars: [{ type: 'tuyul', x: 0.25, to: 0.6, size: 1.5 }] },
 { dur: 2, bg: 'corridor', fx: ['flicker'], flickerLamp: 2, caption: '9. Suster ngesot', chars: [{ type: 'ngesot', x: 0.22, to: 0.4, y: 1420, size: 1.15 }] },
 { dur: 2, bg: 'graveyard', tone: 'blue', caption: '10. Banaspati', chars: [{ type: 'banaspati', x: 0.6, y: 780, size: 0.8 }] },
 { dur: 2, bg: 'room', caption: '11. Tangan & rambut dari plafon', chars: [{ type: 'hand', x: 700, y: 1352, dir: 192, len: 380 }, { type: 'hair', x: 0.42, len: 720 }] },
 { dur: 2, bg: 'forest', fx: ['rain'], lightning: [0.3], caption: '12. Cuma terlihat saat petir', chars: [{ type: 'ghost', x: 0.62, size: 0.8, reveal: 'lightning', still: true }] },
]};
