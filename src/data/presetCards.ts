import { CardItem, CropQuad, CardMetadataTags } from '../types';

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

/**
 * Recreates the tested AEW Black Diamond Hikaru Shida Event Logo Patches Auto card
 * (Matches Year-Manfucturer-Card-0960.jpg uploaded by the user)
 */
export function createHikaruShidaCardCanvas(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800; // Landscape orientation matching scan
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Scanner bed background (dark textured)
  ctx.fillStyle = '#101216';
  ctx.fillRect(0, 0, 1200, 800);

  // Card geometry inside scanner bed
  const cardX = 40;
  const cardY = 30;
  const cardW = 1120;
  const cardH = 740;

  // Dark slate stone border
  ctx.fillStyle = '#1a1c22';
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Gold foil corner accents
  ctx.fillStyle = '#b89047';
  ctx.fillRect(cardX, cardY, 60, cardH);
  ctx.fillRect(cardX + cardW - 120, cardY, 120, cardH);

  // Right Gold Banner: "BLACK DIAMOND" & "AEW EVENT LOGO PATCHES"
  ctx.save();
  ctx.translate(cardX + cardW - 60, cardY + cardH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#0a0d14';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLACK DIAMOND', 0, -15);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('AEW EVENT LOGO PATCHES', 0, 15);
  ctx.restore();

  // Left Autograph window (light blue frosted background)
  const autoX = cardX + 90;
  const autoY = cardY + 90;
  const autoW = 190;
  const autoH = 560;
  ctx.fillStyle = 'rgba(173, 216, 230, 0.45)';
  ctx.fillRect(autoX, autoY, autoW, autoH);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.strokeRect(autoX, autoY, autoW, autoH);

  // Blue ink cursive signature: "Hikaru Shida"
  ctx.save();
  ctx.translate(autoX + autoW / 2, autoY + autoH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Stylized signature strokes
  ctx.moveTo(-180, 0);
  ctx.bezierCurveTo(-140, -40, -100, 30, -60, -10);
  ctx.bezierCurveTo(-20, -50, 40, 40, 80, -20);
  ctx.bezierCurveTo(120, -60, 150, 20, 190, 0);
  ctx.stroke();
  ctx.restore();

  // Center: Recessed Die-Cut Window for Event Patch
  const patchX = cardX + 310;
  const patchY = cardY + 130;
  const patchW = 620;
  const patchH = 480;

  // Silver beveled window border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 8;
  ctx.strokeRect(patchX, patchY, patchW, patchH);

  // Black fabric patch texture
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(patchX + 4, patchY + 4, patchW - 8, patchH - 8);

  // "FULL GEAR" embroidered cog logo
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(patchX + patchW / 2, patchY + patchH / 2, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f1117';
  ctx.beginPath();
  ctx.arc(patchX + patchW / 2, patchY + patchH / 2, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FULL GEAR', patchX + patchW / 2, patchY + patchH / 2 + 12);

  // Subject Header (Hikaru Shida portrait area)
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(patchX + patchW / 2, cardY + 70, 45, 0, Math.PI * 2);
  ctx.fill();

  // Bottom Name: "HIKARU SHIDA"
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HIKARU SHIDA', patchX + patchW / 2, cardY + cardH - 35);

  return canvas.toDataURL('image/png');
}

/**
 * Recreates the tested AEW Black Diamond Julia Hart Squared Circle Gems #36/99 card
 * (Matches Year-Manfucturer-Card-0968.jpg uploaded by the user)
 */
export function createJuliaHartCardCanvas(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Scanner bed dark background
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, 1200, 800);

  // Card geometry inside scanner
  const cardX = 35;
  const cardY = 30;
  const cardW = 1130;
  const cardH = 740;

  // Dark gothic black diamond faceted texture
  ctx.fillStyle = '#13161c';
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Diamond facets background pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < cardW; i += 80) {
    ctx.beginPath();
    ctx.moveTo(cardX + i, cardY);
    ctx.lineTo(cardX + i + 100, cardY + cardH);
    ctx.stroke();
  }

  // Right Rail: "BLACK DIAMOND"
  ctx.save();
  ctx.translate(cardX + cardW - 55, cardY + cardH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BLACK DIAMOND', 0, 0);
  ctx.restore();

  // Left Emblem: "SQUARED CIRCLE GEMS" + "AEW" + "JULIA HART"
  const emblemX = cardX + 180;
  const emblemY = cardY + cardH / 2;

  ctx.save();
  ctx.translate(emblemX, emblemY);
  ctx.rotate(-Math.PI / 6);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(-120, -120, 240, 240);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SQUARED CIRCLE', 0, -30);
  ctx.fillText('GEMS', 0, 0);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 28px sans-serif';
  ctx.fillText('AEW', 0, 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('JULIA HART', 0, 75);
  ctx.restore();

  // Julia Hart Gothic Figure Silhouette
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(cardX + 680, cardY + 340, 150, 0, Math.PI * 2);
  ctx.fill();

  // Blonde hair & black crown highlights
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(cardX + 700, cardY + 280, 70, 0, Math.PI * 2);
  ctx.fill();

  // Stamped Serial Number #36/99 in bottom right foil
  ctx.fillStyle = '#ca8a04'; // Gold foil stamp
  ctx.font = '900 32px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('36/99', cardX + cardW - 120, cardY + cardH - 50);

  return canvas.toDataURL('image/png');
}

/**
 * Returns the exact card representations for the user-tested AEW Black Diamond cards
 * with all metadata fields pre-calibrated.
 */
export function getTestedUserCards(): Array<{
  id: string;
  name: string;
  fileName: string;
  originalUrl: string;
  width: number;
  height: number;
  quad: CropQuad;
  metadata: CardMetadataTags;
}> {
  const hikaruQuad: CropQuad = {
    topLeft: { x: 0.033, y: 0.037 },
    topRight: { x: 0.967, y: 0.037 },
    bottomRight: { x: 0.967, y: 0.963 },
    bottomLeft: { x: 0.033, y: 0.963 }
  };

  const juliaQuad: CropQuad = {
    topLeft: { x: 0.031, y: 0.038 },
    topRight: { x: 0.969, y: 0.038 },
    bottomRight: { x: 0.969, y: 0.962 },
    bottomLeft: { x: 0.031, y: 0.962 }
  };

  return [
    {
      id: 'tested-aew-0960-shida',
      name: 'Hikaru Shida AEW Black Diamond Event Logo Patch Auto',
      fileName: 'Year-Manfucturer-Card-0960.jpg',
      originalUrl: createHikaruShidaCardCanvas(),
      width: 1200,
      height: 800,
      quad: hikaruQuad,
      metadata: {
        sport: 'Wrestling',
        league: 'AEW',
        manufacturer: 'Upper Deck',
        cardSeries: 'Upper Deck AEW Black Diamond',
        year: '2024',
        setName: 'Event Logo Patches Auto',
        parallel: 'Full Gear Patch',
        player: 'Hikaru Shida',
        autographed: 'Yes',
        gradeTarget: 'Near mint or better',
        condition: 'Near mint or better',
        price: '34.99',
        notes: 'Full Gear PPV Event Logo cloth patch, on-card/sticker blue ink autograph'
      }
    },
    {
      id: 'tested-aew-0968-hart',
      name: 'Julia Hart AEW Black Diamond Squared Circle Gems 36/99',
      fileName: 'Year-Manfucturer-Card-0968.jpg',
      originalUrl: createJuliaHartCardCanvas(),
      width: 1200,
      height: 800,
      quad: juliaQuad,
      metadata: {
        sport: 'Wrestling',
        league: 'AEW',
        manufacturer: 'Upper Deck',
        cardSeries: 'Upper Deck AEW Black Diamond',
        year: '2024',
        setName: 'Squared Circle Gems',
        parallel: 'Black Diamond Gems',
        player: 'Julia Hart',
        printRun: '36/99',
        autographed: 'No',
        gradeTarget: 'PSA 10 Gem Mint',
        condition: 'Near mint or better',
        price: '24.99',
        notes: 'Numbered 36/99 foil stamp, House of Black edition'
      }
    }
  ];
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
