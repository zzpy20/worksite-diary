import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Entry } from '@/types/entry';

function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

function buildHtml(entry: Entry): string {
  const photosHtml = entry.photo_urls.length
    ? `<div class="section"><div class="label">Photos</div><div class="photos">${entry.photo_urls
        .map((url) => `<img src="${url}" />`)
        .join('')}</div></div>`
    : '';

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>
  body { font-family: -apple-system, Helvetica, sans-serif; padding: 32px; color: #1a1d24; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .muted { color: #60646c; font-size: 14px; margin-bottom: 20px; }
  .section { margin-top: 18px; }
  .label { font-size: 11px; text-transform: uppercase; color: #60646c; letter-spacing: 0.04em; }
  .value { font-size: 16px; margin-top: 3px; white-space: pre-wrap; }
  .photos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .photos img { width: 170px; height: 170px; object-fit: cover; border-radius: 10px; }
</style></head>
<body>
  <h1>${escapeHtml(entry.site)}</h1>
  <div class="muted">${escapeHtml(entry.date)}</div>
  <div class="section">
    <div class="label">Hours</div>
    <div class="value">${escapeHtml(entry.start_time ?? '—')} to ${escapeHtml(entry.finish_time ?? '—')}</div>
  </div>
  ${
    entry.comments
      ? `<div class="section"><div class="label">Comments</div><div class="value">${escapeHtml(entry.comments)}</div></div>`
      : ''
  }
  ${
    entry.tasks
      ? `<div class="section"><div class="label">Tasks</div><div class="value">${escapeHtml(entry.tasks)}</div></div>`
      : ''
  }
  ${
    entry.latitude != null && entry.longitude != null
      ? `<div class="section"><div class="label">Location</div><div class="value">${escapeHtml(entry.address ?? `${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}`)}</div></div>`
      : ''
  }
  ${photosHtml}
</body>
</html>`;
}

// A4 at 72 PPI (points).
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

export async function shareEntryAsPdf(entry: Entry): Promise<void> {
  const html = buildHtml(entry);
  const { uri } = await Print.printToFileAsync({ html, width: A4_WIDTH, height: A4_HEIGHT });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
}
