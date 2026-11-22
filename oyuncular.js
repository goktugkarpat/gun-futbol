(function (global) {
  'use strict';

  var INK = '#111111';
  var INK_W = 2.0;

  var GS_SARI = '#FFC400';
  var GS_KIRMIZI = '#E60026';
  var FB_SARI = '#FFF01F';
  var FB_LACIVERT = '#0047AB';

  var GS_GK_ANA = '#00E5B0';
  var GS_GK_KOYU = '#008F72';
  var GS_GK_ACIK = '#7CFFE0';

  var FB_GK_ANA = '#FF6B00';
  var FB_GK_MOR = '#5B21B6';
  var FB_GK_ACIK = '#FFA94D';

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    var rad = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function drawStar(ctx, cx, cy, outerR, innerR, points, rot) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var a = rot + (i * Math.PI) / points;
      var r = (i % 2 === 0) ? outerR : innerR;
      var px = cx + Math.cos(a) * r;
      var py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function resolveFacing(p) {
    if (typeof p.yonAci === 'number' && isFinite(p.yonAci)) {
      return p.yonAci;
    }
    var vx = num(p.vx, 0);
    var vy = num(p.vy, 0);
    if (vx * vx + vy * vy > 0.04) {
      return Math.atan2(vy, vx);
    }
    return p.takim === 'FB' ? Math.PI : 0;
  }

  function resolveKit(p, isGK) {
    var kulup = (p.takim === 'GS') ? 'GS' : (p.kulup || p.takim || 'FB');
    if (p.takim === 'FB') {
      if (isGK) {
        if (kulup === 'BJK') {
          return {
            ana: '#84CC16',
            ikinci: '#1E293B',
            parlak: '#BEF264',
            sort: '#16181D',
            sortSerit: '#84CC16',
            corap: '#16181D',
            corapSerit: '#84CC16',
            eldiven: '#84CC16',
            eldivenBilek: '#1E293B',
            kulup: kulup,
            tip: 'gk-fb'
          };
        }
        if (kulup === 'TS') {
          return {
            ana: '#FACC15',
            ikinci: '#002D72',
            parlak: '#FEF08A',
            sort: '#1E293B',
            sortSerit: '#FACC15',
            corap: '#1E293B',
            corapSerit: '#FACC15',
            eldiven: '#FACC15',
            eldivenBilek: '#002D72',
            kulup: kulup,
            tip: 'gk-fb'
          };
        }
        return {
          ana: FB_GK_ANA,
          ikinci: FB_GK_MOR,
          parlak: FB_GK_ACIK,
          sort: '#3B0764',
          sortSerit: FB_GK_ANA,
          corap: FB_GK_ANA,
          corapSerit: FB_GK_MOR,
          eldiven: FB_GK_ANA,
          eldivenBilek: FB_GK_MOR,
          kulup: kulup,
          tip: 'gk-fb'
        };
      }
      if (kulup === 'BJK') {
        return {
          ana: '#FFFFFF',
          ikinci: '#141414',
          parlak: '#FFFFFF',
          sort: '#16181D',
          sortSerit: '#FFFFFF',
          corap: '#FFFFFF',
          corapSerit: '#141414',
          kulup: 'BJK',
          tip: 'bjk-cubuklu'
        };
      }
      if (kulup === 'TS') {
        return {
          ana: '#7C1332',
          ikinci: '#00A8E8',
          parlak: '#A61C45',
          sort: '#5E0D25',
          sortSerit: '#00A8E8',
          corap: '#00A8E8',
          corapSerit: '#7C1332',
          kulup: 'TS',
          tip: 'ts-cubuklu'
        };
      }
      return {
        ana: FB_SARI,
        ikinci: FB_LACIVERT,
        parlak: '#FFF67A',
        sort: FB_LACIVERT,
        sortSerit: FB_SARI,
        corap: FB_LACIVERT,
        corapSerit: FB_SARI,
        kulup: 'FB',
        tip: 'cubuklu'
      };
    }

    if (isGK) {
      return {
        ana: GS_GK_ANA,
        ikinci: GS_GK_KOYU,
        parlak: GS_GK_ACIK,
        sort: '#0A3D36',
        sortSerit: GS_GK_ACIK,
        corap: GS_GK_ANA,
        corapSerit: '#FFFFFF',
        eldiven: GS_GK_ANA,
        eldivenBilek: GS_GK_KOYU,
        kulup: 'GS',
        tip: 'gk-gs'
      };
    }

    return {
      ana: GS_SARI,
      ikinci: GS_KIRMIZI,
      parlak: '#FFD95A',
      sort: '#FFFFFF',
      sortSerit: GS_KIRMIZI,
      corap: GS_KIRMIZI,
      corapSerit: GS_SARI,
      kulup: 'GS',
      tip: 'parcali'
    };
  }

  function drawGroundRings(ctx, p, aktifMi, pasHedefMi, t, dx, dy, scale, hamleOran) {
    // Ground shadow
    ctx.save();
    ctx.translate(dx * hamleOran * 4, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, (14.5 + hamleOran * 5) * scale, 7.2 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Unmistakable team-colored ring beneath every player
    var kulup = (p.takim === 'GS') ? 'GS' : (p.kulup || p.takim || 'FB');
    var halkaDolgu = kulup === 'BJK'
      ? 'rgba(24, 24, 27, 0.24)'
      : (kulup === 'TS'
        ? 'rgba(124, 19, 50, 0.24)'
        : (kulup === 'FB' ? 'rgba(0, 88, 235, 0.20)' : 'rgba(230, 0, 38, 0.18)'));
    var halkaKenar = kulup === 'BJK'
      ? 'rgba(226, 232, 240, 0.95)'
      : (kulup === 'TS'
        ? 'rgba(56, 189, 248, 0.95)'
        : (kulup === 'FB' ? 'rgba(35, 145, 255, 0.94)' : 'rgba(255, 42, 72, 0.92)'));
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 1, 15.5 * scale, 8.6 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = halkaDolgu;
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = halkaKenar;
    ctx.stroke();
    ctx.restore();

    // #61 GÜN rotating gold-red star/crown ring
    if (p.gunMu) {
      var gRx = 23.5 * scale;
      var gRy = 14.2 * scale;
      var rot = t * 2.1;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 1, gRx, gRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 185, 18, 0.16)';
      ctx.fill();

      // Rotating segmented gold & crimson track
      ctx.lineWidth = 2.6;
      for (var seg = 0; seg < 4; seg++) {
        var a0 = rot + seg * (Math.PI * 0.5) + 0.14;
        var a1 = a0 + Math.PI * 0.5 - 0.28;
        ctx.beginPath();
        ctx.ellipse(0, 1, gRx, gRy, 0, a0, a1);
        ctx.strokeStyle = (seg % 2 === 0) ? '#FFD700' : '#E0113D';
        ctx.stroke();
      }

      // Orbiting star / crown jewels
      for (var sIdx = 0; sIdx < 6; sIdx++) {
        var sa = rot + (sIdx * Math.PI) / 3;
        var sx = Math.cos(sa) * gRx;
        var sy = 1 + Math.sin(sa) * gRy;
        var isGold = sIdx % 2 === 0;
        drawStar(ctx, sx, sy, isGold ? 4.3 : 3.5, isGold ? 1.9 : 1.6, 4, rot * 1.4);
        ctx.fillStyle = isGold ? '#FFE042' : '#D90B38';
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Pass target pulsing golden-mint ring + bobbing downward chevron
    if (pasHedefMi) {
      var pPulse = 1 + 0.09 * Math.sin(t * 7.5);
      var pRx = 20.5 * scale * pPulse;
      var pRy = 12.4 * scale * pPulse;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 1, pRx, pRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 232, 90, 0.18)';
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -t * 24;
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = 'rgba(255, 232, 90, 0.96)';
      ctx.stroke();
      ctx.setLineDash([]);

      // Small bobbing yellow downward chevron right above target ring
      var chevY = 1 - pRy - 3 + Math.sin(t * 7.5) * 2.0;
      ctx.beginPath();
      ctx.moveTo(0, chevY + 4.5);
      ctx.lineTo(-5.2, chevY - 2.2);
      ctx.lineTo(5.2, chevY - 2.2);
      ctx.closePath();
      ctx.fillStyle = '#FFE85A';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }

    // Active controlled player: dual bright cyan / gold ring + directional triangle arrow
    if (aktifMi) {
      var aPulse = 1 + 0.035 * Math.sin(t * 6.5);
      var cRx = 20 * scale * aPulse;
      var cRy = 12.2 * scale * aPulse;

      ctx.save();
      // Soft outer cyan glow
      ctx.beginPath();
      ctx.ellipse(0, 1, cRx + 1.5, cRy + 1, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.30)';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Bright cyan outer ring
      ctx.beginPath();
      ctx.ellipse(0, 1, cRx, cRy, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      // Crisp gold inner ring
      ctx.beginPath();
      ctx.ellipse(0, 1, cRx - 3.3, cRy - 2.1, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFD93D';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Directional triangle arrow in yonAci
      var ax = dx * (cRx + 5.5);
      var ay = 1 + dy * (cRy + 4.0);
      var tipX = ax + dx * 6.2;
      var tipY = ay + dy * 4.6;
      var perpX = -dy;
      var perpY = dx;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(ax - dx * 1.6 + perpX * 4.2, ay - dy * 1.2 + perpY * 3.0);
      ctx.lineTo(ax - dx * 1.6 - perpX * 4.2, ay - dy * 1.2 - perpY * 3.0);
      ctx.closePath();
      ctx.fillStyle = '#00F5FF';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTackleDust(ctx, dx, dy, t, hamleOran) {
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var dist = (8 + i * 5.5) * hamleOran;
      var px = -dx * dist + Math.sin(t * 20 + i * 2.1) * 2.5;
      var py = 1 - dy * dist * 0.6 - i * 1.2;
      var r = (4.2 - i * 0.9) * hamleOran;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.72)' : 'rgba(220,245,195,0.58)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLegAndBoot(ctx, hipX, hipY, footX, footY, kit, ten, facingDir, isKickLeg) {
    // Sock / calf
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Knee/leg outline + fill
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(footX, footY - 1.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6.2;
    ctx.stroke();

    ctx.strokeStyle = ten;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Team sock on lower leg
    var midX = hipX + (footX - hipX) * 0.36;
    var midY = hipY + (footY - 1.5 - hipY) * 0.36;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(footX, footY - 1.5);
    ctx.strokeStyle = kit.corap;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Sock stripe
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX + (footX - midX) * 0.28, midY + (footY - 1.5 - midY) * 0.28);
    ctx.strokeStyle = kit.corapSerit;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Cleat / boot
    ctx.translate(footX, footY);
    var bootDir = Math.abs(facingDir) > 0.25 ? (facingDir > 0 ? 1 : -1) : (hipX >= 0 ? 1 : -1);
    ctx.scale(bootDir, 1);

    ctx.beginPath();
    ctx.ellipse(1.2, 0.2, isKickLeg ? 4.8 : 4.2, 2.7, isKickLeg ? -0.25 : 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1D222B';
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Crisp boot highlight stripe
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.5);
    ctx.lineTo(2.4, 0.1);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  function drawArm(ctx, shoulderX, shoulderY, handX, handY, sleeveColor, ten, isGK, kit) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Full arm ink base
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6.2;
    ctx.stroke();

    // Forearm skin
    ctx.strokeStyle = ten;
    ctx.lineWidth = 3.0;
    ctx.stroke();

    // Short sleeve over upper half
    var sleeveEndX = shoulderX + (handX - shoulderX) * 0.56;
    var sleeveEndY = shoulderY + (handY - shoulderY) * 0.56;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(sleeveEndX, sleeveEndY);
    ctx.strokeStyle = sleeveColor;
    ctx.lineWidth = 3.6;
    ctx.stroke();

    // Hand or chunky Goalkeeper Glove
    if (isGK) {
      ctx.beginPath();
      ctx.arc(handX, handY, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2.1;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Colored keeper glove backhand
      ctx.beginPath();
      ctx.arc(handX, handY, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = kit.eldiven;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(handX, handY, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = ten;
      ctx.fill();
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawJersey(ctx, p, kit, dx, dy, isGK) {
    ctx.save();

    // Broad athletic Captain Tsubasa torso path for instant kit silhouette
    function torsoPath() {
      ctx.beginPath();
      ctx.moveTo(-7.8, -4.5);
      ctx.quadraticCurveTo(-9.6, -10.0, -11.2, -14.8);
      ctx.quadraticCurveTo(-10.0, -17.2, -4.4, -17.4);
      ctx.lineTo(4.4, -17.4);
      ctx.quadraticCurveTo(10.0, -17.2, 11.2, -14.8);
      ctx.quadraticCurveTo(9.6, -10.0, 7.8, -4.5);
      ctx.closePath();
    }

    torsoPath();
    ctx.save();
    ctx.clip();

    if (kit.tip === 'parcali') {
      // GS Parçalı: Sarı (#FDB912) & Kırmızı (#A90432) halves
      ctx.fillStyle = GS_SARI;
      ctx.fillRect(-12, -19, 12, 17);
      ctx.fillStyle = GS_KIRMIZI;
      ctx.fillRect(0, -19, 12, 17);
    } else if (kit.tip === 'cubuklu' || kit.tip === 'bjk-cubuklu' || kit.tip === 'ts-cubuklu') {
      // Çubuklu: FB (Sarı-Lacivert), BJK (Siyah-Beyaz), TS (Bordo-Mavi)
      ctx.fillStyle = kit.ana;
      ctx.fillRect(-12, -19, 24, 17);
      ctx.fillStyle = kit.ikinci;
      var stripeW = 4.1;
      for (var sx = -10.25; sx <= 10; sx += stripeW * 2) {
        ctx.fillRect(sx, -19, stripeW, 17);
      }
    } else if (kit.tip === 'gk-gs') {
      // GS GK (#1 Uğurcan): Emerald / Turquoise
      ctx.fillStyle = GS_GK_ANA;
      ctx.fillRect(-12, -19, 24, 17);
      ctx.fillStyle = GS_GK_KOYU;
      ctx.beginPath();
      ctx.moveTo(-11, -17.5);
      ctx.lineTo(11, -17.5);
      ctx.lineTo(0, -11.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(85, 239, 196, 0.32)';
      ctx.fillRect(-6, -11.5, 12, 7);
    } else {
      // FB GK (#31 Ederson): Orange & Purple
      ctx.fillStyle = FB_GK_ANA;
      ctx.fillRect(-12, -19, 24, 17);
      ctx.fillStyle = FB_GK_MOR;
      ctx.fillRect(-12, -18, 4.6, 16);
      ctx.fillRect(7.4, -18, 4.6, 16);
      ctx.beginPath();
      ctx.moveTo(-6, -17.5);
      ctx.lineTo(6, -17.5);
      ctx.lineTo(0, -13.0);
      ctx.closePath();
      ctx.fill();
    }

    // Subtle anime cel-shading bottom/edge shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(-12, -7.2, 24, 4);

    // Collar trim
    ctx.beginPath();
    ctx.arc(0, -17.2, 3.8, 0, Math.PI);
    ctx.fillStyle = isGK ? '#FFFFFF' : (kit.kulup === 'BJK' ? '#141414' : (kit.kulup === 'TS' ? '#00A8E8' : (p.takim === 'FB' ? FB_LACIVERT : GS_KIRMIZI)));
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.restore(); // end clip

    // Bold black ink outline
    torsoPath();
    ctx.lineWidth = INK_W;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Legible jersey number on chest / back
    if (p.no !== undefined && p.no !== null && p.no !== '') {
      var noStr = String(p.no);
      var numX = dx * 1.1;
      var numY = dy < -0.25 ? -10.8 : -9.4;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = p.gunMu
        ? '900 10.8px "Arial Black", "Segoe UI", Arial, sans-serif'
        : '900 8.8px "Arial Black", "Segoe UI", Arial, sans-serif';

      if (p.gunMu) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 224, 60, 0.9)';
        ctx.shadowBlur = 5;
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = INK;
        ctx.strokeText(noStr, numX, numY);
        ctx.fillStyle = '#FFF59E';
        ctx.fillText(noStr, numX, numY);
        ctx.restore();
      } else {
        ctx.lineWidth = 2.9;
        ctx.strokeStyle = INK;
        ctx.strokeText(noStr, numX, numY);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(noStr, numX, numY);
      }
    }

    ctx.restore();
  }

  function drawHead(ctx, p, dx, dy, t, sutOran) {
    var sac = p.sac || (p.gunMu ? '#2A1911' : '#241B16');
    var ten = p.ten || '#F4C6A0';
    var hasBand = Boolean(p.band || p.gunMu);
    var headX = dx * 0.7;
    var headY = -23.6;
    var rx = 9.0;
    var ry = 8.4;
    var facingBack = dy < -0.35;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1) Back-layer hair silhouettes (afro / rasta / Gün spiky back + headband tails)
    if (p.afro) {
      var afroPuffs = 9;
      // Pass 1: seamless thick black comic ink silhouette
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, -3.4, 12.2 + INK_W * 0.9, 10.2 + INK_W * 0.9, 0, 0, Math.PI * 2);
      for (var i = 0; i < afroPuffs; i++) {
        var pa = -Math.PI * 1.08 + (i / (afroPuffs - 1)) * Math.PI * 1.16;
        var px = Math.cos(pa) * 10.6;
        var py = -2.2 + Math.sin(pa) * 9.8;
        ctx.moveTo(px + 4.4 + INK_W * 0.9, py);
        ctx.arc(px, py, 4.4 + INK_W * 0.9, 0, Math.PI * 2);
      }
      ctx.fill();

      // Pass 2: inner hair fill without interior seam strokes
      ctx.fillStyle = sac;
      ctx.beginPath();
      ctx.ellipse(0, -3.4, 12.2, 10.2, 0, 0, Math.PI * 2);
      for (var j = 0; j < afroPuffs; j++) {
        var pa2 = -Math.PI * 1.08 + (j / (afroPuffs - 1)) * Math.PI * 1.16;
        var px2 = Math.cos(pa2) * 10.6;
        var py2 = -2.2 + Math.sin(pa2) * 9.8;
        ctx.moveTo(px2 + 4.4, py2);
        ctx.arc(px2, py2, 4.4, 0, Math.PI * 2);
      }
      ctx.fill();

      // Subtle curly highlight arcs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-4.2, -8.4, 3.0, Math.PI * 1.0, Math.PI * 1.75);
      ctx.moveTo(4.8, -7.8);
      ctx.arc(2.5, -7.8, 2.3, Math.PI * 1.1, Math.PI * 1.85);
      ctx.stroke();
    } else if (p.rasta) {
      // Flowing rasta dreadlocks around left, right & back
      var dreadAngles = [-2.65, -2.35, -2.0, -0.5, -0.15, 0.2, 2.75, 0.42];
      for (var d = 0; d < dreadAngles.length; d++) {
        var side = d < 4 ? -1 : 1;
        var idxSide = d % 4;
        var sx = side * (7.2 + idxSide * 1.2);
        var sy = -5.5 + idxSide * 1.8;
        var ex = side * (9.2 + idxSide * 1.4) - dx * 1.5;
        var ey = 5.5 + idxSide * 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + side * 2.2, (sy + ey) * 0.5, ex, ey);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.6;
        ctx.stroke();
        ctx.strokeStyle = sac;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    } else if (p.gunMu) {
      // Cool Captain Tsubasa spiky silhouette halo behind head
      ctx.beginPath();
      ctx.moveTo(-9.5, -2.0);
      ctx.lineTo(-12.2, -7.8);
      ctx.lineTo(-7.2, -7.6);
      ctx.lineTo(-7.6, -13.2);
      ctx.lineTo(-2.2, -9.8);
      ctx.lineTo(1.2, -14.8);
      ctx.lineTo(4.2, -9.6);
      ctx.lineTo(9.4, -12.6);
      ctx.lineTo(7.8, -7.0);
      ctx.lineTo(12.2, -6.8);
      ctx.lineTo(9.2, -1.8);
      ctx.closePath();
      ctx.fillStyle = sac;
      ctx.fill();
      ctx.lineWidth = INK_W;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    // Fluttering yellow-red headband tails behind head
    if (hasBand) {
      var tailDir = Math.abs(dx) > 0.2 ? (dx > 0 ? -1 : 1) : -1;
      var flutter = Math.sin(t * 11) * 1.8;
      var bx = tailDir * 8.2;
      var by = -3.8;

      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + tailDir * 5, by - 1.5 + flutter, bx + tailDir * 8.5, by + 1.5 + flutter);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.8;
      ctx.stroke();
      ctx.strokeStyle = GS_SARI;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, by + 1.4);
      ctx.quadraticCurveTo(bx + tailDir * 4.5, by + 2.4 - flutter * 0.7, bx + tailDir * 7.8, by + 4.4 - flutter * 0.7);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = GS_KIRMIZI;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // 2) Ears (when not hidden by afro/rasta)
    if (!p.afro && !p.rasta) {
      ctx.fillStyle = ten;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.ellipse(-rx + 0.5, 0.8, 2.0, 2.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(rx - 0.5, 0.8, 2.0, 2.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 3) Main head oval
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = ten;
    ctx.fill();
    ctx.lineWidth = INK_W;
    ctx.strokeStyle = INK;
    ctx.stroke();

    if (facingBack) {
      // Back-of-head view
      if (!p.kel) {
        ctx.beginPath();
        ctx.ellipse(0, -1.0, rx, ry * 0.92, 0, 0, Math.PI * 2);
        ctx.fillStyle = sac;
        ctx.fill();
        ctx.lineWidth = INK_W;
        ctx.strokeStyle = INK;
        ctx.stroke();

        if (p.rasta) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.4;
          for (var rb = -4; rb <= 4; rb += 2.6) {
            ctx.beginPath();
            ctx.moveTo(rb, -6.5);
            ctx.lineTo(rb * 1.1, 6.2);
            ctx.stroke();
          }
        }
      } else {
        // Bald head comic shine on back too
        ctx.beginPath();
        ctx.arc(-2.6, -3.8, 2.2, Math.PI * 0.9, Math.PI * 1.7);
        ctx.strokeStyle = 'rgba(255,255,255,0.68)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      if (hasBand) {
        drawHeadbandStrip(ctx, rx, -3.2);
      }

      if (p.maske) {
        // Thin black mask strap across back of head
        ctx.beginPath();
        ctx.moveTo(-rx + 0.4, 0.5);
        ctx.quadraticCurveTo(0, 1.4, rx - 0.4, 0.5);
        ctx.strokeStyle = '#1C2029';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    // 4) Front / 3/4 / Side Face Features
    var lookX = clamp(dx * 2.8, -3.0, 3.0);
    var lookY = clamp(dy * 1.2, -0.6, 1.2);

    // Subtle warm cheek glow for Gün
    if (p.gunMu) {
      ctx.fillStyle = 'rgba(255, 105, 115, 0.26)';
      ctx.beginPath();
      ctx.ellipse(lookX - 4.2, 2.6 + lookY * 0.4, 1.8, 1.0, 0, 0, Math.PI * 2);
      ctx.ellipse(lookX + 4.2, 2.6 + lookY * 0.4, 1.8, 1.0, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Osimhen Protective Carbon Face Mask
    if (p.maske) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lookX - 6.8, -1.6 + lookY);
      ctx.quadraticCurveTo(lookX, -2.5 + lookY, lookX + 6.8, -1.6 + lookY);
      ctx.lineTo(lookX + 6.4, 3.2 + lookY);
      ctx.quadraticCurveTo(lookX + 2.8, 3.8 + lookY, lookX, 4.4 + lookY);
      ctx.quadraticCurveTo(lookX - 2.8, 3.8 + lookY, lookX - 6.4, 3.2 + lookY);
      ctx.closePath();
      ctx.fillStyle = '#1E232D';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Sleek mask ridge highlight
      ctx.beginPath();
      ctx.moveTo(lookX - 4.5, -1.0 + lookY);
      ctx.lineTo(lookX + 4.5, -1.0 + lookY);
      ctx.strokeStyle = 'rgba(140, 165, 200, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.restore();
    }

    // Expressive Anime Eyes (near eye larger, far eye narrower in 3/4 view)
    var eyeSep = 3.3 * (1 - 0.18 * Math.abs(dx));
    var leftEyeScale = dx > 0.35 ? 0.78 : 1.0;
    var rightEyeScale = dx < -0.35 ? 0.78 : 1.0;
    var eyeY = 0.4 + lookY * 0.7;

    drawAnimeEye(ctx, lookX - eyeSep, eyeY, leftEyeScale, dx, sutOran, p.maske);
    drawAnimeEye(ctx, lookX + eyeSep, eyeY, rightEyeScale, dx, sutOran, p.maske);

    // Determined eyebrows
    var browTilt = 0.7 + sutOran * 0.8;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    ctx.moveTo(lookX - eyeSep - 2.1 * leftEyeScale, eyeY - 2.6 - browTilt * 0.4);
    ctx.lineTo(lookX - eyeSep + 1.5 * leftEyeScale, eyeY - 2.0 + browTilt * 0.6);
    ctx.moveTo(lookX + eyeSep + 2.1 * rightEyeScale, eyeY - 2.6 - browTilt * 0.4);
    ctx.lineTo(lookX + eyeSep - 1.5 * rightEyeScale, eyeY - 2.0 + browTilt * 0.6);
    ctx.stroke();

    // Mouth (determined shout on shot, confident smile on Gün, crisp line otherwise)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    if (sutOran > 0.2) {
      ctx.beginPath();
      ctx.ellipse(lookX * 0.9, 4.6 + lookY * 0.4, 1.8, 1.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#9E1B32';
      ctx.fill();
      ctx.stroke();
    } else if (p.gunMu) {
      ctx.beginPath();
      ctx.arc(lookX * 0.9, 3.8 + lookY * 0.4, 2.3, 0.25, Math.PI - 0.25);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(lookX * 0.9 - 1.5, 4.5 + lookY * 0.4);
      ctx.lineTo(lookX * 0.9 + 1.5, 4.3 + lookY * 0.4);
      ctx.stroke();
    }

    // 5) Front / Top Hair Styles
    if (p.kel) {
      // Kanté: smooth bald crown shine!
      ctx.beginPath();
      ctx.arc(-3.0, -4.4, 2.2, Math.PI * 0.95, Math.PI * 1.65);
      ctx.strokeStyle = 'rgba(255,255,255,0.78)';
      ctx.lineWidth = 1.9;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-0.5, -5.6, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
    } else if (p.afro) {
      // Sané: fluffy front afro hairline over forehead
      ctx.beginPath();
      ctx.moveTo(-8.4, -2.5);
      ctx.quadraticCurveTo(-5.0, -5.2, -2.0, -3.6);
      ctx.quadraticCurveTo(0.8, -5.8, 3.6, -3.8);
      ctx.quadraticCurveTo(6.5, -5.0, 8.4, -2.5);
      ctx.arc(0, -3.2, 9.6, -0.1, Math.PI + 0.1, true);
      ctx.closePath();
      ctx.fillStyle = sac;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else if (p.rasta) {
      // Aké: crown rasta cap + front twisted locks
      ctx.beginPath();
      ctx.ellipse(0, -5.2, 8.8, 4.4, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(4.0, -3.0, 0, -4.2);
      ctx.quadraticCurveTo(-4.0, -3.0, -8.8, -5.2);
      ctx.closePath();
      ctx.fillStyle = sac;
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else if (p.gunMu) {
      // 61 GÜN: Yellow-red headband + spiky anime bangs!
      drawHeadbandStrip(ctx, rx, -3.4);

      ctx.beginPath();
      ctx.moveTo(-8.6, -4.2);
      ctx.lineTo(-9.5, -9.2);
      ctx.lineTo(-4.8, -7.2);
      ctx.lineTo(-2.5, -12.0);
      ctx.lineTo(0.6, -7.6);
      ctx.lineTo(3.8, -11.8);
      ctx.lineTo(5.6, -7.2);
      ctx.lineTo(9.4, -9.0);
      ctx.lineTo(8.6, -4.2);
      // Forehead spikes over headband
      ctx.lineTo(5.4, -2.6);
      ctx.lineTo(3.2, -4.2);
      ctx.lineTo(0.2, -1.8);
      ctx.lineTo(-2.8, -4.0);
      ctx.lineTo(-5.6, -2.5);
      ctx.closePath();
      ctx.fillStyle = sac;
      ctx.fill();
      ctx.lineWidth = 2.1;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Hair highlight
      ctx.beginPath();
      ctx.moveTo(-4.5, -7.4);
      ctx.quadraticCurveTo(0, -8.8, 4.2, -7.4);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      // Standard varied anime hairstyles (including Osimhen blonde crop)
      var hairVariant = p.maske ? 2 : (Math.abs(Number(p.no) || 0) % 3);
      ctx.beginPath();
      ctx.arc(0, -1.6, rx + 0.3, Math.PI * 1.02, Math.PI * 1.98);
      if (hairVariant === 0) {
        // Swept anime bangs
        ctx.quadraticCurveTo(5.5, -2.6, 2.2, -4.2);
        ctx.quadraticCurveTo(-1.0, -1.8, -4.5, -4.5);
        ctx.quadraticCurveTo(-7.2, -3.2, -rx - 0.2, -2.0);
      } else if (hairVariant === 1) {
        // Neat spiky top
        ctx.lineTo(6.0, -4.2);
        ctx.lineTo(2.4, -2.5);
        ctx.lineTo(0, -4.8);
        ctx.lineTo(-3.2, -2.5);
        ctx.lineTo(-6.5, -4.4);
      } else {
        // Crisp short crop / Osimhen blonde top
        ctx.quadraticCurveTo(4.0, -4.8, 0, -4.4);
        ctx.quadraticCurveTo(-4.0, -4.8, -rx - 0.2, -2.0);
      }
      ctx.closePath();
      ctx.fillStyle = sac;
      ctx.fill();
      ctx.lineWidth = 2.1;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // Subtle hair shine
      ctx.beginPath();
      ctx.arc(-1.8, -6.2, 3.4, Math.PI * 1.15, Math.PI * 1.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (hasBand) {
        drawHeadbandStrip(ctx, rx, -3.2);
      }
    }

    ctx.restore();
  }

  function drawHeadbandStrip(ctx, rx, yPos) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-rx + 0.3, yPos - 1.3);
    ctx.quadraticCurveTo(0, yPos - 2.3, rx - 0.3, yPos - 1.3);
    ctx.lineTo(rx - 0.3, yPos + 1.3);
    ctx.quadraticCurveTo(0, yPos + 0.3, -rx + 0.3, yPos + 1.3);
    ctx.closePath();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = GS_SARI;
    ctx.fillRect(-rx, yPos - 3, rx, 6);
    ctx.fillStyle = GS_KIRMIZI;
    ctx.fillRect(0, yPos - 3, rx, 6);
    ctx.restore();

    ctx.lineWidth = 1.7;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  function drawAnimeEye(ctx, ex, ey, scaleX, dx, sutOran, inMask) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(scaleX, 1);

    // White sclera
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.0, 2.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = inMask ? 1.0 : 1.3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Determined iris / pupil
    var px = clamp(dx * 0.45, -0.5, 0.5);
    ctx.beginPath();
    ctx.arc(px, 0.1, sutOran > 0.2 ? 1.15 : 1.25, 0, Math.PI * 2);
    ctx.fillStyle = '#15151C';
    ctx.fill();

    // Anime white catchlight sparkle
    ctx.beginPath();
    ctx.arc(px - 0.45, -0.55, 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.restore();
  }

  function drawLabels(ctx, p, scale, t) {
    // Bottom team-colored sharp name pill (#C80828 GS vs #0A3D9E FB)
    if (p.ad) {
      var label = String(p.ad);
      ctx.save();
      ctx.font = '900 9.6px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var tw = ctx.measureText(label).width;
      var pw = tw + 11;
      var ph = 14.2;
      var ly = 18.6 * scale;
      var kulup = (p.takim === 'GS') ? 'GS' : (p.kulup || p.takim || 'FB');
      var bgCol = kulup === 'BJK' ? '#18181B' : (kulup === 'TS' ? '#6E102C' : (kulup === 'FB' ? '#0A3D9E' : '#C80828'));
      var borderCol = p.gunMu ? '#FFD700' : (kulup === 'BJK' ? '#F8FAFC' : (kulup === 'TS' ? '#38BDF8' : (kulup === 'FB' ? '#FFEE00' : '#FFD000')));
      var textCol = p.gunMu ? '#FFF394' : (kulup === 'FB' ? '#FFF68F' : '#FFFFFF');

      roundedRectPath(ctx, -pw * 0.5, ly - ph * 0.5, pw, ph, 6.5);
      ctx.fillStyle = bgCol;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = borderCol;
      ctx.stroke();

      ctx.fillStyle = textCol;
      ctx.fillText(label, 0, ly + 0.4);
      ctx.restore();
    }

    // Glowing dark pill badge with gold frame above GÜN
    if (p.gunMu) {
      ctx.save();
      var badgeText = 'GÜN';
      ctx.font = '900 15.5px "Arial Black", "Segoe UI", Arial, sans-serif';   // 11 inç tablette de okunsun
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var bw = ctx.measureText(badgeText).width + 22;
      var bh = 23.5;
      var by = -51.0 * scale + Math.sin(t * 4.5) * 1.1;

      // Golden outer glow
      ctx.shadowColor = 'rgba(255, 215, 0, 0.85)';
      ctx.shadowBlur = 9 + 3 * Math.sin(t * 5.5);

      roundedRectPath(ctx, -bw * 0.5, by - bh * 0.5, bw, bh, bh * 0.5);
      ctx.fillStyle = '#190C14';
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#FFD700';
      ctx.stroke();

      // Tiny gold pointer pip toward Gün's head
      ctx.beginPath();
      ctx.moveTo(-3.2, by + bh * 0.5 - 0.5);
      ctx.lineTo(3.2, by + bh * 0.5 - 0.5);
      ctx.lineTo(0, by + bh * 0.5 + 3.6);
      ctx.closePath();
      ctx.fillStyle = '#FFD700';
      ctx.fill();

      // Crisp 61 (gold) + GÜN (bright white) or unified bright gold-white
      ctx.fillStyle = '#FFE44D';
      ctx.fillText(badgeText, 0, by + 0.5);
      ctx.restore();
    }
  }

  function oyuncuCiz(ctx, p, aktifMi, pasHedefMi, t) {
    if (!ctx || !p) return;

    var time = num(t, 0);
    var x = num(p.x, 0);
    var y = num(p.y, 0);
    var yonAci = resolveFacing(p);
    var dx = Math.cos(yonAci);
    var dy = Math.sin(yonAci);
    var isGK = p.rol === 'GK' || p.rol === 'KL' || p.rol === 'KALECI';
    var scale = p.iri ? 1.32 : (p.gunMu ? 1.28 : 1.22);
    var kit = resolveKit(p, isGK);
    var ten = p.ten || '#F4C6A0';

    var vx = num(p.vx, 0);
    var vy = num(p.vy, 0);
    var speed = Math.sqrt(vx * vx + vy * vy);
    var moveFactor = speed > 0.25 ? clamp(speed / 2.0, 0, 1) : 0;
    var faz = num(p.kosuFaz, 0);
    var stride = Math.sin(faz) * moveFactor;

    var hamleT = Math.max(0, num(p.hamleT, 0));
    var sutT = Math.max(0, num(p.sutT, 0));
    var tacAtisT = Math.max(0, num(p.tacAtisT, 0));
    var kafaT = Math.max(0, num(p.kafaT, 0));
    var kafaMax = Math.max(0.1, num(p.kafaMax, 0.46));
    var tacTutuyor = Boolean(p.tacTutuyor);
    var hamleOran = hamleT > 0 ? clamp(Math.max(0.5, hamleT * 3.2), 0, 1) : 0;
    var sutOran = sutT > 0 ? clamp(Math.max(0.5, sutT * 3.6), 0, 1) : 0;
    var tacAtisOran = tacAtisT > 0 ? clamp(tacAtisT / 0.32, 0, 1) : 0;
    var kafaOran = kafaT > 0 ? clamp(Math.sin((1 - kafaT / kafaMax) * Math.PI), 0, 1) : 0;

    var ucusT = isGK ? Math.max(0, num(p.ucusT, 0)) : 0;
    var ucusMax = Math.max(0.1, num(p.ucusMax, 0.56));
    var ucusYon = num(p.ucusYon, 0);
    var ucusAktif = isGK && ucusT > 0 && ucusYon !== 0;
    var ucusProg = ucusAktif ? clamp(1 - ucusT / ucusMax, 0, 1) : 0;
    var ucusH = ucusAktif ? Math.sin(clamp(ucusProg / 0.82, 0, 1) * Math.PI) * 19 : 0;

    ctx.save();
    ctx.translate(x, y);

    // 1) Ground shadow & selection/status rings
    drawGroundRings(ctx, p, Boolean(aktifMi), Boolean(pasHedefMi), time, dx, dy, scale, hamleOran);

    if (ucusAktif) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ucusYon * 4, 2, 22 * scale, 6.8 * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.fill();

      // Comic wind speed lines trailing opposite dive direction
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      for (var wi = 0; wi < 3; wi++) {
        var wy = (-8 - wi * 7) * scale;
        var wLen = (16 + wi * 4) * scale;
        ctx.beginPath();
        ctx.moveTo(-ucusYon * 6, wy);
        ctx.lineTo(-ucusYon * (6 + wLen), wy);
        ctx.stroke();
      }
      ctx.restore();

      if (ucusProg > 0.65) {
        drawTackleDust(ctx, ucusYon, 0, time, (ucusProg - 0.65) / 0.35);
      }
    } else if (kafaOran > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 1, (13 + 7 * kafaOran) * scale, (6.5 + 3.5 * kafaOran) * scale, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 245, 160, ' + (0.55 * kafaOran).toFixed(2) + ')';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    if (hamleOran > 0) {
      drawTackleDust(ctx, dx, dy, time, hamleOran);
    }

    // 2) Animated Chibi Body
    var bob = (hamleOran > 0)
      ? -4.2 * hamleOran
      : (kafaOran > 0 ? 21.0 * kafaOran : Math.abs(Math.cos(faz)) * 2.1 * moveFactor);
    var tilt = (hamleOran > 0)
      ? dx * 0.34 * hamleOran
      : (tacTutuyor ? -dx * 0.14 : (tacAtisOran > 0 ? dx * 0.22 * tacAtisOran : (kafaOran > 0 ? (Math.abs(dx) > 0.18 ? dx : (dy < 0 ? 0.45 : -0.45)) * 0.36 * kafaOran : (sutOran > 0 ? -dx * 0.14 * sutOran : dx * 0.06 * moveFactor))));

    ctx.save();
    ctx.scale(scale, scale);
    if (ucusAktif) {
      var diveAngle = ucusYon * 1.38 * Math.sin(clamp(ucusProg * 1.25, 0, 1) * Math.PI * 0.5);
      ctx.translate(ucusYon * 5 * Math.sin(ucusProg * Math.PI), -(6 + ucusH));
      ctx.rotate(diveAngle);
    } else {
      ctx.translate(dx * hamleOran * 3.5, -bob);
      ctx.rotate(tilt);
    }

    // Leg & boot positions
    var hipSpread = 4.1 * (1 - 0.34 * Math.abs(dx));
    var hipY = -5.2;
    var footLX, footLY, footRX, footRY;
    var kickLeft = false;
    var kickRight = false;

    if (ucusAktif) {
      footLX = -3.8;
      footLY = 6.2;
      footRX = 4.2;
      footRY = 3.5;
    } else if (hamleOran > 0) {
      // Slide tackle / lunge extension
      footLX = dx * 10.8 * hamleOran - hipSpread * 0.4;
      footLY = dy * 5.2 * hamleOran - 0.8;
      footRX = -dx * 4.5 * hamleOran + hipSpread * 0.7;
      footRY = -dy * 2.0 * hamleOran + 0.6;
      kickLeft = true;
    } else if (kafaOran > 0) {
      // Tucked airborne header legs
      footLX = -hipSpread * 0.9 - dx * 3.0 * kafaOran;
      footLY = -2.2 * kafaOran;
      footRX = hipSpread * 0.9 - dx * 4.2 * kafaOran;
      footRY = -3.2 * kafaOran;
    } else if (tacTutuyor || tacAtisOran > 0) {
      // Planted feet for legal two-handed throw-in
      footLX = -hipSpread * 0.92 - dx * 2.0;
      footLY = 0.8 - dy * 1.4;
      footRX = hipSpread * 0.92 + dx * 2.0;
      footRY = 0.8 + dy * 1.4;
    } else if (sutOran > 0) {
      // Follow-through single-leg kick swing
      footLX = -dx * 2.0 - hipSpread * 0.85;
      footLY = 0.8;
      footRX = dx * 8.6 * sutOran + hipSpread * 0.45;
      footRY = dy * 4.4 * sutOran - 3.2 * sutOran;
      kickRight = true;
    } else {
      var liftL = Math.max(0, stride) * 2.3;
      var liftR = Math.max(0, -stride) * 2.3;
      footLX = -hipSpread + dx * stride * 5.6;
      footLY = 0.8 + dy * stride * 3.6 - liftL;
      footRX = hipSpread - dx * stride * 5.6;
      footRY = 0.8 - dy * stride * 3.6 - liftR;
    }

    // Motion arc during kick or overhead throw whip
    if (sutOran > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx * 2, -1.5, 9.5, yonAci - 0.7, yonAci + 0.55);
      ctx.strokeStyle = 'rgba(255, 240, 120, ' + (0.75 * sutOran).toFixed(2) + ')';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
    if (tacAtisOran > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx * 3, -24, 11.5, -Math.PI * 0.95, Math.PI * 0.05);
      ctx.strokeStyle = 'rgba(255, 240, 120, ' + (0.72 * tacAtisOran).toFixed(2) + ')';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Draw legs
    drawLegAndBoot(ctx, -hipSpread, hipY, footLX, footLY, kit, ten, dx, kickLeft);
    drawLegAndBoot(ctx, hipSpread, hipY, footRX, footRY, kit, ten, dx, kickRight);

    // Shorts
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-7.2, -5.8);
    ctx.lineTo(7.2, -5.8);
    ctx.lineTo(7.8, -2.0);
    ctx.lineTo(1.2, -2.0);
    ctx.lineTo(0, -3.2);
    ctx.lineTo(-1.2, -2.0);
    ctx.lineTo(-7.8, -2.0);
    ctx.closePath();
    ctx.fillStyle = kit.sort;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Shorts side trim
    ctx.strokeStyle = kit.sortSerit;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6.3, -5.0);
    ctx.lineTo(-6.8, -2.7);
    ctx.moveTo(6.3, -5.0);
    ctx.lineTo(6.8, -2.7);
    ctx.stroke();
    ctx.restore();

    // Arms (back arm slightly behind, front arm in front)
    var armSwing = hamleOran > 0 ? 4.2 : (sutOran > 0 ? 4.8 * sutOran : stride * 4.0);
    var sleeveL = kit.tip === 'parcali' ? GS_KIRMIZI : (kit.tip === 'cubuklu' ? FB_LACIVERT : kit.ana);
    var sleeveR = kit.tip === 'parcali' ? GS_SARI : (kit.tip === 'cubuklu' ? FB_LACIVERT : (kit.tip === 'bjk-cubuklu' ? '#FFFFFF' : (kit.tip === 'ts-cubuklu' ? '#00A8E8' : kit.ana)));

    var shLX = -9.6;
    var shRX = 9.6;
    var shY = -14.2;
    var hLX = -11.4 - dx * armSwing * 0.7;
    var hLY = -7.6 - dy * armSwing * 0.4 - (sutOran > 0 ? 3.5 : 0);
    var hRX = 11.4 + dx * armSwing * 0.7;
    var hRY = -7.6 + dy * armSwing * 0.4 - (hamleOran > 0 ? 3.0 : 0);

    if (ucusAktif) {
      drawJersey(ctx, p, kit, ucusYon, 0.1, isGK);
      drawHead(ctx, p, ucusYon, 0.1, time, 0.85);
      drawArm(ctx, shLX, shY, -5.2, -33.5, sleeveL, ten, true, kit);
      drawArm(ctx, shRX, shY, 5.2, -33.5, sleeveR, ten, true, kit);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -35.5, 11.5, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    } else if (tacTutuyor || tacAtisOran > 0) {
      // Both arms raised over head (holding throw-in ball or whipping forward)
      var fw = tacAtisOran > 0 ? (1 - tacAtisOran) : 0;
      var throwShiftX = tacTutuyor ? -dx * 2.8 : dx * (-2.2 + fw * 11.5);
      var throwShiftY = tacTutuyor ? -34.0 - dy * 2.0 : (-33.5 + fw * 12.5 + dy * fw * 4.5);
      drawJersey(ctx, p, kit, dx, dy, isGK);
      drawHead(ctx, p, dx, dy, time, Math.max(sutOran, tacAtisOran * 0.6));
      drawArm(ctx, shLX, shY, -5.8 + throwShiftX, throwShiftY, sleeveL, ten, isGK, kit);
      drawArm(ctx, shRX, shY, 5.8 + throwShiftX, throwShiftY, sleeveR, ten, isGK, kit);
    } else if (isGK && p.kaleciTutuyor) {
      // Goalkeeper cradling caught ball cleanly in both gloved hands in front of chest
      drawJersey(ctx, p, kit, dx, dy, isGK);
      drawHead(ctx, p, dx, dy, time, 0.25);
      drawArm(ctx, shLX, shY, -6.2 + dx * 2.5, -11.5 + dy * 3.0, sleeveL, ten, isGK, kit);
      drawArm(ctx, shRX, shY, 6.2 + dx * 2.5, -11.5 + dy * 3.0, sleeveR, ten, isGK, kit);
    } else {
      if (kafaOran > 0) {
        hLX = -13.8;
        hLY = -11.8;
        hRX = 13.8;
        hRY = -11.8;
      }
      // Draw trailing arm behind torso, leading arm after torso
      if (dx >= 0) {
        drawArm(ctx, shLX, shY, hLX, hLY, sleeveL, ten, isGK, kit);
        drawJersey(ctx, p, kit, dx, dy, isGK);
        drawArm(ctx, shRX, shY, hRX, hRY, sleeveR, ten, isGK, kit);
      } else {
        drawArm(ctx, shRX, shY, hRX, hRY, sleeveR, ten, isGK, kit);
        drawJersey(ctx, p, kit, dx, dy, isGK);
        drawArm(ctx, shLX, shY, hLX, hLY, sleeveL, ten, isGK, kit);
      }

      // Chibi Anime Head
      drawHead(ctx, p, dx, dy, time, Math.max(sutOran, kafaOran * 0.7));

      if (kafaOran > 0.42) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(dx * 4, -31.5, 10.5, yonAci - 0.85, yonAci + 0.85);
        ctx.strokeStyle = '#FFF394';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore(); // end scaled/tilted body

    // 3) Upright Labels & #61 GÜN glowing badge
    drawLabels(ctx, p, scale, time);

    ctx.restore();
  }

  function drawAslanAura(ctx, x, ballY, vx, vy, r, t) {
    var speed = Math.sqrt(vx * vx + vy * vy);
    var moveAci = speed > 0.2 ? Math.atan2(vy, vx) : 0;
    var backAci = moveAci + Math.PI;

    ctx.save();

    // Blazing Tsubasa flame tail opposite motion
    if (speed > 0.2) {
      var tailLen = clamp(24 + speed * 0.22, 26, 62);
      var perpX = -Math.sin(backAci);
      var perpY = Math.cos(backAci);

      // Outer crimson-orange lion flame tongues
      for (var layer = 0; layer < 2; layer++) {
        var len = layer === 0 ? tailLen : tailLen * 0.68;
        var width = layer === 0 ? r * 1.35 : r * 0.85;
        ctx.beginPath();
        ctx.moveTo(x + perpX * width, ballY + perpY * width);
        for (var i = 1; i <= 5; i++) {
          var frac = i / 5;
          var flicker = Math.sin(t * 28 + i * 2.3 + layer) * (3.2 - frac * 1.5);
          var w = width * (1 - frac * 0.88);
          var side = (i % 2 === 0 ? 1 : -1) * w;
          ctx.lineTo(
            x + Math.cos(backAci) * len * frac + perpX * (side + flicker),
            ballY + Math.sin(backAci) * len * frac + perpY * (side + flicker)
          );
        }
        ctx.lineTo(x + Math.cos(backAci) * (len + 6), ballY + Math.sin(backAci) * (len + 6));
        ctx.lineTo(x - perpX * width, ballY - perpY * width);
        ctx.closePath();

        if (layer === 0) {
          var grad0 = ctx.createLinearGradient(
            x, ballY,
            x + Math.cos(backAci) * len, ballY + Math.sin(backAci) * len
          );
          grad0.addColorStop(0, 'rgba(255, 80, 0, 0.92)');
          grad0.addColorStop(0.55, 'rgba(253, 185, 18, 0.72)');
          grad0.addColorStop(1, 'rgba(169, 4, 50, 0)');
          ctx.fillStyle = grad0;
        } else {
          ctx.fillStyle = 'rgba(255, 248, 175, 0.85)';
        }
        ctx.fill();
      }
    }

    // Spinning Tsubasa shock ring & energy arcs around the ball
    var shockR = r * (1.58 + 0.14 * Math.sin(t * 24));
    ctx.beginPath();
    ctx.arc(x, ballY, shockR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    for (var s = 0; s < 3; s++) {
      var aStart = t * 14 + s * ((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.arc(x, ballY, shockR + 2.4, aStart, aStart + 0.95);
      ctx.strokeStyle = s % 2 === 0 ? '#FF4D00' : '#FFF280';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  function topCiz(ctx, top, t) {
    if (!ctx || !top) return;

    var time = num(t, 0);
    var x = num(top.x, 0);
    var y = num(top.y, 0);
    var z = Math.max(0, num(top.z, 0));
    var vx = num(top.vx, 0);
    var vy = num(top.vy, 0);
    var donus = num(top.donus, 0);
    var aslanMi = Boolean(top.aslanMi);

    var baseR = 8.4;
    var ballScale = clamp(1 + z * 0.008, 1, 2.25);
    var r = baseR * ballScale;
    var ballY = y - z;

    // Ground shadow: shrinks & separates slightly as z rises
    ctx.save();
    var shScale = Math.max(0.32, 1 - z * 0.0055);
    var shAlpha = Math.max(0.10, 0.34 - z * 0.0018);
    var shX = x + z * 0.12;
    var shY = y + 2.2 + z * 0.05;
    ctx.beginPath();
    ctx.ellipse(shX, shY, baseR * 1.12 * shScale, baseR * 0.58 * shScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, ' + shAlpha.toFixed(3) + ')';
    ctx.fill();
    ctx.restore();

    // Smooth translucent speed trail for fast passes & shots
    if (!aslanMi && Array.isArray(top.iz) && top.iz.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      for (var ti = 0; ti < top.iz.length; ti++) {
        var pt0 = top.iz[ti];
        var pt1 = (ti + 1 < top.iz.length) ? top.iz[ti + 1] : { x: x, y: y, z: z };
        var frac = (ti + 1) / (top.iz.length + 1);
        ctx.beginPath();
        ctx.moveTo(pt0.x, pt0.y - num(pt0.z, 0));
        ctx.lineTo(pt1.x, pt1.y - num(pt1.z, 0));
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.28 * frac).toFixed(3) + ')';
        ctx.lineWidth = r * 1.25 * frac;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Tsubasa flame-gold tail & shock ring
    if (aslanMi) {
      drawAslanAura(ctx, x, ballY, vx, vy, r, time);
    }

    // Classic black-and-white pentagon soccer ball
    ctx.save();
    ctx.translate(x, ballY);

    // Base sphere gradient
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    var ballGrad = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.12, 0, 0, r);
    ballGrad.addColorStop(0, aslanMi ? '#FFFDF0' : '#FFFFFF');
    ballGrad.addColorStop(0.68, aslanMi ? '#FFE9A8' : '#EBF0F6');
    ballGrad.addColorStop(1, aslanMi ? '#FDB912' : '#BCC6D4');
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Clip inside sphere for rotating pentagons
    ctx.save();
    ctx.clip();
    ctx.rotate(donus);

    // Center pentagon
    var pR = r * 0.38;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI * 0.5 + (i * Math.PI * 2) / 5;
      var px = Math.cos(a) * pR;
      var py = Math.sin(a) * pR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#181A20';
    ctx.fill();

    // Seam lines & outer pentagon patches
    ctx.strokeStyle = 'rgba(30, 34, 42, 0.58)';
    ctx.lineWidth = Math.max(1.0, r * 0.11);
    for (var j = 0; j < 5; j++) {
      var sa = -Math.PI * 0.5 + (j * Math.PI * 2) / 5;
      var sx = Math.cos(sa) * pR;
      var sy = Math.sin(sa) * pR;
      var ex = Math.cos(sa) * (r * 0.88);
      var ey = Math.sin(sa) * (r * 0.88);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Rim pentagon cap
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * (r * 0.96), Math.sin(sa) * (r * 0.96), r * 0.27, 0, Math.PI * 2);
      ctx.fillStyle = '#181A20';
      ctx.fill();
    }

    ctx.restore(); // end ball clip

    // Specular glossy shine (always from stadium floodlights top-left)
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.34, r * 0.24, r * 0.14, -0.65, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();

    // Thick comic ink outline
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = aslanMi ? 2.6 : 2.3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.restore();
  }

  function kontrolOkCiz(ctx, aktif, hedef, sutGucOran, t) {
    if (!ctx || !aktif) return;

    var ax = num(aktif.x, 0);
    var ay = num(aktif.y, 0);
    var time = num(t, 0);

    // 1) Sleek aiming line when target exists
    if (hedef && isFinite(hedef.x) && isFinite(hedef.y)) {
      var hx = hedef.x;
      var hy = hedef.y;
      var dx = hx - ax;
      var dy = hy - ay;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 34) {
        var ux = dx / dist;
        var uy = dy / dist;
        var sx = ax + ux * 20;
        var sy = ay + uy * 13;
        var ex = hx - ux * 20;
        var ey = hy - uy * 13;

        ctx.save();
        var grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, 'rgba(60, 248, 255, 0.60)');
        grad.addColorStop(0.5, 'rgba(180, 255, 210, 0.90)');
        grad.addColorStop(1, 'rgba(255, 232, 90, 1.0)');

        ctx.lineCap = 'round';
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -time * 32;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = 'rgba(8, 14, 22, 0.52)';
        ctx.lineWidth = 5.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = grad;
        ctx.stroke();
        ctx.setLineDash([]);

        // Bold solid yellow arrowhead pointing into receiver's feet
        var px = -uy;
        var py = ux;
        ctx.beginPath();
        ctx.moveTo(ex + ux * 8.5, ey + uy * 8.5);
        ctx.lineTo(ex - ux * 4.5 + px * 6.5, ey - uy * 4.5 + py * 6.5);
        ctx.lineTo(ex - ux * 4.5 - px * 6.5, ey - uy * 4.5 - py * 6.5);
        ctx.closePath();
        ctx.fillStyle = '#FFE85A';
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2) Curved power arc under player when charging shot or Aslan Shot ready
    var guc = (typeof sutGucOran === 'number' && isFinite(sutGucOran))
      ? clamp(sutGucOran, 0, 1)
      : (aktif.aslanHazir ? 1 : 0);

    if (guc > 0.01 || aktif.aslanHazir) {
      var oran = Math.max(guc, aktif.aslanHazir ? 1 : 0);
      var rx = 25.5;
      var ry = 15.2;
      var cy = ay + 2.5;
      var startA = Math.PI * 0.85;
      var endMaxA = Math.PI * 0.15;
      var sweep = (startA - endMaxA) * oran;
      var curA = startA - sweep;

      ctx.save();
      ctx.lineCap = 'round';

      // Dark gauge track backing
      ctx.beginPath();
      ctx.ellipse(ax, cy, rx, ry, 0, startA, endMaxA, true);
      ctx.strokeStyle = 'rgba(10, 14, 22, 0.78)';
      ctx.lineWidth = 6.2;
      ctx.stroke();

      // Power color ramp
      var color;
      if (oran >= 0.82) {
        color = '#FF4D00';
      } else if (oran >= 0.48) {
        color = '#FFD000';
      } else {
        color = '#38F9D7';
      }

      if (oran >= 0.82) {
        ctx.shadowColor = 'rgba(255, 195, 0, 0.95)';
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.ellipse(ax, cy, rx, ry, 0, startA, curA, true);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.8;
      ctx.stroke();

      // Golden core spark tip at high power / Aslan Shot ready
      if (oran >= 0.82) {
        var tipX = ax + Math.cos(curA) * rx;
        var tipY = cy + Math.sin(curA) * ry;
        drawStar(ctx, tipX, tipY, 5.2, 2.2, 4, oran * 6);
        ctx.fillStyle = '#FFF58C';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }

      // Pulsing directional aim chevron while charging shot / set piece
      if (guc > 0.05 && guc < 1) {
        var nAci = typeof aktif.yonAci === 'number' ? aktif.yonAci : -Math.PI * 0.5;
        var uxN = Math.cos(nAci);
        var uyN = Math.sin(nAci);
        var pxN = -uyN;
        var pyN = uxN;
        var nabiz = 0.78 + Math.sin(time * 14) * 0.22;
        var mesafeN = 28 + oran * 24;
        var nxN = ax + uxN * mesafeN;
        var nyN = cy + uyN * mesafeN;
        ctx.beginPath();
        ctx.moveTo(nxN + uxN * 6, nyN + uyN * 6);
        ctx.lineTo(nxN - uxN * 4.5 + pxN * 5.2, nyN - uyN * 4.5 + pyN * 5.2);
        ctx.moveTo(nxN + uxN * 6, nyN + uyN * 6);
        ctx.lineTo(nxN - uxN * 4.5 - pxN * 5.2, nyN - uyN * 4.5 - pyN * 5.2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.88 * nabiz;
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  global.OYUNCU_CIZ = {
    oyuncuCiz: oyuncuCiz,
    topCiz: topCiz,
    kontrolOkCiz: kontrolOkCiz
  };
})(typeof window !== 'undefined' ? window : globalThis);
