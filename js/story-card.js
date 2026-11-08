// Story image (1080×1920) in UON Hub colours, shared straight to Instagram/WhatsApp
// stories through the Web Share API, or downloaded where sharing files isn't supported.
const W = 1080, H = 1920, GREEN = '#0B3B2C', GREEN2 = '#0F5A41', GOLD = '#CFA038', GOLD2 = '#E4C77E', INK = '#F5F1E6', MUTED = '#B9C7BF';
const FONT = 'Tajawal, system-ui, sans-serif';

function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; if (lines.length === maxLines) break; } else line = t; }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  return lines;
}

/** opts: {kicker, headline, title, stats:[[value,label],...], cta, url} → Promise<Blob> */
export async function storyCardBlob(opts) {
  try { await document.fonts?.load(`900 120px ${FONT}`); await document.fonts?.load(`700 40px ${FONT}`); } catch {}
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, GREEN); bg.addColorStop(.7, '#072619'); bg.addColorStop(1, '#051a11'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 900); glow.addColorStop(0, 'rgba(207,160,56,.32)'); glow.addColorStop(1, 'rgba(207,160,56,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 900);
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // brand lockup: logo on the LEFT of the wordmark
  try {
    const logo = await loadImage('/assets/uonhub-logo-original-20260904.jpeg');
    ctx.font = `900 64px ${FONT}`; ctx.direction = 'ltr'; const word = 'UON Hub', ww = ctx.measureText(word).width, size = 104, gap = 26, total = size + gap + ww, x0 = (W - total) / 2, y0 = 170;
    ctx.save(); ctx.beginPath(); ctx.arc(x0 + size / 2, y0 + size / 2, size / 2, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, x0, y0, size, size); ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(x0 + size / 2, y0 + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText(word, x0 + size + gap, y0 + size / 2 + 22); ctx.textAlign = 'center'; ctx.direction = 'rtl';
  } catch {}
  // kicker pill
  ctx.font = `800 40px ${FONT}`; const k = String(opts.kicker || 'جامعة نزوى'), kw = ctx.measureText(k).width + 70;
  round(ctx, (W - kw) / 2, 380, kw, 74, 37); ctx.fillStyle = 'rgba(207,160,56,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(207,160,56,.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = GOLD2; ctx.fillText(k, W / 2, 431);
  // headline (course code) + title
  ctx.direction = 'ltr'; ctx.font = `900 ${String(opts.headline || '').length > 8 ? 140 : 170}px ${FONT}`; ctx.fillStyle = INK; ctx.fillText(String(opts.headline || ''), W / 2, 680); ctx.direction = 'rtl';
  ctx.font = `800 64px ${FONT}`; ctx.fillStyle = GOLD2;
  wrap(ctx, opts.title, 900, 2).forEach((l, i) => ctx.fillText(l, W / 2, 790 + i * 84));
  // stats
  const stats = (opts.stats || []).slice(0, 3); const cw = 290, gapx = 30, sx = (W - (stats.length * cw + (stats.length - 1) * gapx)) / 2;
  stats.forEach(([value, label], i) => {
    const x = W - sx - (i + 1) * cw - i * gapx; // RTL order
    round(ctx, x, 1010, cw, 230, 36); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(207,160,56,.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `900 96px ${FONT}`; ctx.fillText(String(value), x + cw / 2, 1130); ctx.fillStyle = MUTED; ctx.font = `700 40px ${FONT}`; ctx.fillText(String(label), x + cw / 2, 1200);
  });
  // call to action + link-sticker area
  ctx.fillStyle = INK; ctx.font = `800 54px ${FONT}`; wrap(ctx, opts.cta || 'كل شي عن المادة في مكان واحد 👇', 920, 2).forEach((l, i) => ctx.fillText(l, W / 2, 1390 + i * 72));
  round(ctx, 140, 1500, W - 280, 150, 75); ctx.setLineDash([16, 14]); ctx.strokeStyle = 'rgba(207,160,56,.65)'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = GOLD2; ctx.direction = 'ltr'; { const shown = String(opts.display || opts.url || 'uonhub.space').replace(/^https?:\/\/(www\.)?/, '').slice(0, 48); let fs = 56; do { ctx.font = `800 ${fs}px ${FONT}`; fs -= 2; } while (ctx.measureText(shown).width > W - 360 && fs > 26); ctx.fillText(shown, W / 2, 1594); }
  ctx.fillStyle = MUTED; ctx.font = `700 38px ${FONT}`; ctx.fillText('@uonhub', W / 2, 1790); ctx.direction = 'rtl';
  ctx.font = `600 32px ${FONT}`; ctx.fillText('مشروع طلابي مستقل', W / 2, 1845);
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(Error('story_canvas')), 'image/png'));
}

/** Share the card as a file (mobile), or download it. Copies the link for the link sticker. */
export async function shareStory(opts, filename = 'uonhub-story.png') {
  const blob = await storyCardBlob(opts);
  try { if (opts.url) await navigator.clipboard?.writeText(opts.url); } catch {}
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'UON Hub' }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
