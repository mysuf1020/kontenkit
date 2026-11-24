// Contoh story: "Rumah Kosong di Ujung Gang" (±50 detik)
window.STORY = {
  tag: 'Kisah Horor',
  watermark: '@akunmu',
  accent: '#c4161c',
  tone: 'blue',
  scenes: [
    { dur: 4, bg: 'black', title: 'Rumah Kosong di Ujung Gang', subtitle: 'jangan nonton sendirian', fx: ['flicker'],
      sfx: [{ type: 'sting', at: 0.3 }] },

    { dur: 6.5, bg: 'road', tone: 'amber', roadMove: false, fx: ['dust'],
      camera: { zoom: [1, 1.08] },
      chars: [{ type: 'person', x: 0.22, to: 0.48, action: 'walk', accessory: 'bag' }],
      caption: 'Setiap malam, Raka pulang kerja lewat *gang sempit* yang sama.' },

    { dur: 6.5, bg: 'house', fx: ['fog'], litWindow: -1,
      camera: { zoom: [1.05, 1.15] },
      chars: [{ type: 'person', x: 0.2, action: 'idle', accessory: 'bag', size: 0.8 }],
      caption: 'Di ujung gang itu ada rumah yang sudah *kosong sepuluh tahun.*' },

    { dur: 6, bg: 'house', fx: ['fog', 'flicker'], litWindow: 1,
      camera: { zoom: [1.1, 1.25], pan: [0, 0.06] },
      chars: [{ type: 'person', x: 0.2, action: 'tremble', accessory: 'bag', size: 0.8 }],
      caption: 'Tapi malam itu, *lampu di lantai dua menyala.*',
      sfx: [{ type: 'creak', at: 1.5 }] },

    { dur: 5.5, bg: 'house', fx: ['fog', 'heartbeat'], litWindow: 1, windowFigure: true,
      camera: { zoom: [1.3, 1.55], pan: [0.05, 0.12] },
      caption: 'Dan ada *seseorang* berdiri di jendelanya.' },

    { dur: 6.5, bg: 'corridor', fx: ['flicker', 'dust'], flickerLamp: 1,
      chars: [{ type: 'person', x: 0.5, action: 'idle', accessory: 'flashlight', flicker: true, face: 1, size: 0.95 }],
      caption: 'Penasaran, Raka masuk. Lantainya berdebu, *tanpa jejak kaki.*',
      sfx: [{ type: 'knock', at: 3.6 }] },

    { dur: 7, bg: 'corridor', fx: ['flicker', 'heartbeat', 'glitch'], flickerLamp: 2,
      chars: [{ type: 'ghost', x: 0.5, y: 1250, size: 0.55, action: 'approach', grow: 2.1, appear: 'flicker', in: 1.2 }],
      caption: 'Lalu dari ujung lorong, *sesuatu* mulai mendekat...',
      scare: { at: 5.9, type: 'face', dur: 0.8 } },

    { dur: 7, bg: 'black', fx: ['flicker'],
      chars: [{ type: 'eyes', x: 0.5, y: 820, size: 1, appear: 'fade', in: 0.8, color: '#ff3b30' }],
      caption: 'Raka tidak pernah pulang. Kalau kamu lewat gang itu... *jangan menoleh ke jendela.*',
      captionPos: 'bottom', sfx: [{ type: 'whisper', at: 1 }] },
  ],
};
