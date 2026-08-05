import { CardItem, CropQuad } from '../types';

function createSampleCardCanvas(type: 'vintage' | 'holographic' | 'psa_scratch' | 'cyberpunk'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1120; // 2.5 : 3.5 ratio exactly
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background / Surface table canvas
  ctx.fillStyle = '#12131c';
  ctx.fillRect(0, 0, 800, 1120);

  // Outer Margin / Border simulation (desk background padding)
  const cardX = 90;
  const cardY = 110;
  const cardW = 620;
  const cardH = 900;

  // Drop shadow behind card
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 15;

  if (type === 'vintage') {
    // 1952 Classic Vintage Baseball Card Style
    ctx.fillStyle = '#f6f0df';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    // Card Inner Frame
    ctx.strokeStyle = '#2b261f';
    ctx.lineWidth = 4;
    ctx.strokeRect(cardX + 25, cardY + 25, cardW - 50, cardH - 50);

    // Golden Oval / Banner
    const gradient = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    gradient.addColorStop(0, '#c99635');
    gradient.addColorStop(1, '#8c6115');
    ctx.fillStyle = gradient;
    ctx.fillRect(cardX + 45, cardY + 45, cardW - 90, 520);

    // Vintage Player Figure Illustration
    ctx.fillStyle = '#1e3d59';
    ctx.beginPath();
    ctx.arc(cardX + cardW / 2, cardY + 280, 160, 0, Math.PI * 2);
    ctx.fill();

    // Star icon & Text
    ctx.fillStyle = '#f6f0df';
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.fillText('HALL OF FAME', cardX + cardW / 2, cardY + 270);

    ctx.fillStyle = '#cc3333';
    ctx.font = '900 48px sans-serif';
    ctx.fillText('MICKEY MANTLE', cardX + cardW / 2, cardY + 680);

    ctx.fillStyle = '#333333';
    ctx.font = '24px sans-serif';
    ctx.fillText('OUTFIELD • NEW YORK', cardX + cardW / 2, cardY + 730);

  } else if (type === 'holographic') {
    // Modern Holographic Rare Dragon Trading Card
    const holoGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    holoGrad.addColorStop(0, '#ff007f');
    holoGrad.addColorStop(0.25, '#7f00ff');
    holoGrad.addColorStop(0.5, '#00f3ff');
    holoGrad.addColorStop(0.75, '#00ff66');
    holoGrad.addColorStop(1, '#ffea00');

    ctx.fillStyle = holoGrad;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    // Golden Border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 12;
    ctx.strokeRect(cardX + 10, cardY + 10, cardW - 20, cardH - 20);

    // Inner Art Box
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(cardX + 40, cardY + 100, cardW - 80, 480);

    // Metallic Emblem
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(cardX + cardW / 2, cardY + 340, 140, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ AETHER DRAGON', cardX + cardW / 2, cardY + 70);

    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('HP 3400 • LEGENDARY', cardX + cardW / 2, cardY + 660);

  } else if (type === 'psa_scratch') {
    // PSA Graded Slab with Surface Scratches & Scuffs
    ctx.fillStyle = '#e8ecf2';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    // Slab Header Red Bar
    ctx.fillStyle = '#d92626';
    ctx.fillRect(cardX + 30, cardY + 30, cardW - 60, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GEM MINT 10', cardX + cardW / 2, cardY + 75);
    ctx.font = '18px monospace';
    ctx.fillText('CERT #98421094', cardX + cardW / 2, cardY + 110);

    // Card inside slab
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(cardX + 50, cardY + 170, cardW - 100, 680);

    // Inner artwork
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('ROOKIE CARD', cardX + cardW / 2, cardY + 500);

    // Draw Surface Scratches (Narrow white/gray brightness lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;

    // Scratch 1: diagonal top right
    ctx.beginPath();
    ctx.moveTo(cardX + 220, cardY + 280);
    ctx.lineTo(cardX + 480, cardY + 360);
    ctx.stroke();

    // Scratch 2: vertical jagged scratch
    ctx.beginPath();
    ctx.moveTo(cardX + 340, cardY + 420);
    ctx.lineTo(cardX + 360, cardY + 620);
    ctx.stroke();

    // Scratch 3: arc scuff
    ctx.beginPath();
    ctx.arc(cardX + 420, cardY + 650, 80, 0.2, 1.8);
    ctx.stroke();

  } else {
    // Cyberpunk Neon Hologram Card
    ctx.fillStyle = '#050b14';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(cardX + 15, cardY + 15, cardW - 30, cardH - 30);

    ctx.fillStyle = '#00f3ff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEON CYBERNETIC', cardX + cardW / 2, cardY + 100);

    // Scratches on glass casing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 150, cardY + 250);
    ctx.lineTo(cardX + 450, cardY + 290);
    ctx.moveTo(cardX + 200, cardY + 500);
    ctx.lineTo(cardX + 380, cardY + 680);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

export function getPresetCards(): CardItem[] {
  const defaultQuad: CropQuad = {
    topLeft: { x: 0.1125, y: 0.098 },
    topRight: { x: 0.8875, y: 0.098 },
    bottomRight: { x: 0.8875, y: 0.901 },
    bottomLeft: { x: 0.1125, y: 0.901 }
  };

  const vintageUrl = createSampleCardCanvas('vintage');
  const holoUrl = createSampleCardCanvas('holographic');
  const psaUrl = createSampleCardCanvas('psa_scratch');
  const cyberUrl = createSampleCardCanvas('cyberpunk');

  return [
    {
      id: 'preset-psa-scratch',
      name: 'PSA 10 Slab (Scratch Damaged)',
      originalUrl: psaUrl,
      imageElement: null,
      width: 800,
      height: 1120,
      quad: { ...defaultQuad },
      status: 'Idle',
      isPreset: true
    },
    {
      id: 'preset-vintage-mantle',
      name: '1952 Mickey Mantle Vintage',
      originalUrl: vintageUrl,
      imageElement: null,
      width: 800,
      height: 1120,
      quad: { ...defaultQuad },
      status: 'Idle',
      isPreset: true
    },
    {
      id: 'preset-holo-dragon',
      name: 'Aether Dragon Holographic',
      originalUrl: holoUrl,
      imageElement: null,
      width: 800,
      height: 1120,
      quad: { ...defaultQuad },
      status: 'Idle',
      isPreset: true
    },
    {
      id: 'preset-cyber-card',
      name: 'Cyberpunk Neon Relic',
      originalUrl: cyberUrl,
      imageElement: null,
      width: 800,
      height: 1120,
      quad: { ...defaultQuad },
      status: 'Idle',
      isPreset: true
    }
  ];
}
