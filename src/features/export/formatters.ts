import { displayHinglish } from '@/database/repositories/segments';
import type { Meeting, TranscriptSegment } from '@/types';
import { formatClock, formatDateTime, formatDuration, formatSrtTime } from '@/utils/format';

export type ExportContent = 'both' | 'english' | 'hinglish';

const MODE_LABEL: Record<Meeting['mode'], string> = {
  physical: 'In-person (phone microphone)',
  laptop: 'Laptop speakers → phone microphone',
  same_phone: 'Same phone (permitted playback capture)',
};

export const EXPORT_PRIVACY_NOTE =
  'This file contains a meeting transcript generated on-device by MeetLingo AI. Machine transcription and Hinglish translation can contain errors. Share only with people who are allowed to see the meeting content.';

function header(meeting: Meeting, segments: TranscriptSegment[]): string[] {
  const end = meeting.endedAt ?? meeting.updatedAt;
  return [
    `Meeting: ${meeting.title}`,
    `Date: ${formatDateTime(meeting.startedAt)}`,
    `Duration: ${formatDuration(end - meeting.startedAt)}`,
    `Source: ${MODE_LABEL[meeting.mode]}`,
    `Segments: ${segments.length}`,
    `Status: ${meeting.status}`,
  ];
}

/** Bilingual plain text transcript. */
export function toTxt(meeting: Meeting, segments: TranscriptSegment[], content: ExportContent = 'both', withPrivacyNote = true): string {
  const lines = [...header(meeting, segments), ''];
  if (withPrivacyNote) lines.push(EXPORT_PRIVACY_NOTE, '');
  lines.push('—'.repeat(24), '');
  for (const s of segments) {
    const hing = displayHinglish(s);
    const stamp = `[${formatClock(s.startMs)}]`;
    if (content !== 'hinglish') lines.push(`${stamp} ${s.englishText}`);
    if (content !== 'english') {
      const prefix = content === 'hinglish' ? stamp : ' '.repeat(stamp.length);
      lines.push(`${prefix} ${hing ?? '(translation unavailable)'}`);
    }
    lines.push('');
  }
  lines.push('Generated offline by MeetLingo AI. Translation by Google ML Kit (on-device).');
  return lines.join('\n');
}

/** SubRip subtitles. End time falls back to next segment start (or +3 s) when unknown. */
export function toSrt(segments: TranscriptSegment[], content: Exclude<ExportContent, 'both'> | 'both' = 'hinglish'): string {
  const blocks: string[] = [];
  let n = 1;
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    const end = s.endMs ?? (next ? Math.max(s.startMs + 500, next.startMs - 50) : s.startMs + 3000);
    const hing = displayHinglish(s);
    const text =
      content === 'english' ? s.englishText : content === 'hinglish' ? hing ?? s.englishText : [s.englishText, hing].filter(Boolean).join('\n');
    if (!text?.trim()) return;
    blocks.push(`${n++}\n${formatSrtTime(s.startMs)} --> ${formatSrtTime(Math.max(end, s.startMs + 300))}\n${text.trim()}\n`);
  });
  return blocks.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Print-ready HTML used by expo-print to render the PDF. Layout: 'columns' (two-column) or 'stacked'. */
export function toHtml(
  meeting: Meeting,
  segments: TranscriptSegment[],
  opts: { content?: ExportContent; layout?: 'columns' | 'stacked'; withPrivacyNote?: boolean } = {},
): string {
  const content = opts.content ?? 'both';
  const layout = content === 'both' ? opts.layout ?? 'columns' : 'stacked';
  const rows = segments
    .map((s) => {
      const hing = displayHinglish(s) ?? '<em>Translation unavailable</em>';
      const en = esc(s.englishText);
      const hi = displayHinglish(s) ? esc(displayHinglish(s)!) : hing;
      if (layout === 'columns') {
        return `<tr><td class="t">${formatClock(s.startMs)}</td><td>${en}</td><td class="h">${hi}</td></tr>`;
      }
      const parts = [];
      if (content !== 'hinglish') parts.push(`<div>${en}</div>`);
      if (content !== 'english') parts.push(`<div class="h">${hi}</div>`);
      return `<tr><td class="t">${formatClock(s.startMs)}</td><td>${parts.join('')}</td></tr>`;
    })
    .join('\n');
  const head =
    layout === 'columns'
      ? '<tr><th>Time</th><th>English</th><th>Hinglish</th></tr>'
      : '<tr><th>Time</th><th>Transcript</th></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Roboto,'Noto Sans',Arial,sans-serif;color:#102846;margin:28px;font-size:11pt}
  h1{font-size:20pt;margin:0 0 4px}
  .meta{color:#64748B;font-size:9.5pt;margin-bottom:10px}
  .note{border:1px solid #E2E8F0;background:#F6F9FC;padding:8px 10px;font-size:9pt;color:#64748B;margin:10px 0 16px}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:9pt;color:#64748B;border-bottom:2px solid #102846;padding:6px 6px}
  td{vertical-align:top;padding:7px 6px;border-bottom:1px solid #E2E8F0;line-height:1.4}
  td.t{white-space:nowrap;color:#64748B;font-variant-numeric:tabular-nums;width:56px}
  .h{color:#0369A1;font-weight:600}
  footer{margin-top:18px;color:#64748B;font-size:8.5pt}
</style></head><body>
<h1>${esc(meeting.title)}</h1>
<div class="meta">${header(meeting, segments).slice(1).map(esc).join(' · ')}</div>
${opts.withPrivacyNote === false ? '' : `<div class="note">${esc(EXPORT_PRIVACY_NOTE)}</div>`}
<table><thead>${head}</thead><tbody>${rows}</tbody></table>
<footer>Generated offline by MeetLingo AI · Translation by Google ML Kit (on-device) · Hinglish produced by rule-based romanisation</footer>
</body></html>`;
}

export function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'meeting';
  return `${base}.${ext}`;
}
