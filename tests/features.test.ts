import { TranslationQueue, type TranslationJob } from '@/features/captions/translationQueue';
import { toHtml, toSrt, toTxt, safeFileName } from '@/features/export/formatters';
import { suggestActionItems } from '@/features/meetings/actionItems';
import { ASR_MODELS, extractedBytes } from '@/features/models/manifest';
import { summarize } from '@/features/summary/extractive';
import type { Meeting, TranscriptSegment } from '@/types';
import { formatClock, formatSrtTime } from '@/utils/format';

const seg = (i: number, startMs: number, englishText: string, hinglishText: string | null = null, extra: Partial<TranscriptSegment> = {}): TranscriptSegment => ({
  id: `s${i}`,
  meetingId: 'm',
  sequenceNo: i,
  startMs,
  endMs: startMs + 2000,
  englishText,
  hindiText: null,
  hinglishText,
  correctedHinglish: null,
  state: hinglishText ? 'translated' : 'final',
  confidence: null,
  speakerLabel: null,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const meeting: Meeting = {
  id: 'm',
  title: 'Weekly Standup <Q3>',
  mode: 'physical',
  source: 'microphone',
  startedAt: Date.UTC(2026, 10, 7, 10, 0),
  endedAt: Date.UTC(2026, 10, 7, 10, 30),
  status: 'completed',
  saveTranscript: true,
  saveAudio: false,
  createdAt: 0,
  updatedAt: 0,
};

describe('action item suggestions', () => {
  it('only suggests explicit commitments and requests, never inventing details', () => {
    const out = suggestActionItems([
      { segmentId: 'a', text: 'I will test it and update the team today.' },
      { segmentId: 'b', text: 'Can you please share the latest build?' },
      { segmentId: 'c', text: 'The weather is nice.' },
      { segmentId: 'd', text: 'What time is it?' },
      { segmentId: 'e', text: "So let's fix the login bug first." },
      { segmentId: 'f', text: 'We need to retest the APK before release.' },
      { segmentId: 'g', text: 'I will not be there.' },
      { segmentId: 'h', text: 'ok' },
    ]);
    expect(out.map((o) => o.sourceSegmentId)).toEqual(['a', 'b', 'e', 'f']);
    expect(out[2].taskText).toBe("Let's fix the login bug first.");
    for (const o of out) expect(Object.keys(o).sort()).toEqual(['sourceSegmentId', 'taskText', 'trigger']);
  });
});

describe('extractive summary', () => {
  it('selects verbatim captions in chronological order with source links', () => {
    const sources = [
      'Good morning everyone.',
      'The release build for the Android app is blocked by a login bug.',
      'We decided the login bug fix ships in the next release build.',
      'Lunch was great yesterday.',
      'Riya will retest the Android release build after the fix.',
      'The dashboard API latency is still high and needs review.',
      'Okay.',
      'Next week we review dashboard API latency again.',
    ].map((text, i) => ({ segmentId: `s${i}`, startMs: i * 10_000, text }));
    const r = summarize(sources, { maxPoints: 3 });
    expect(r.keyPoints).toHaveLength(3);
    for (const k of r.keyPoints) expect(sources.find((s) => s.segmentId === k.segmentId)?.text).toBe(k.text);
    expect(r.keyPoints.map((k) => k.startMs)).toEqual([...r.keyPoints.map((k) => k.startMs)].sort((a, b) => a - b));
    expect(r.keywords).toEqual(expect.arrayContaining(['release', 'build', 'login']));
    expect(r.keyPoints.find((k) => k.text.includes('Lunch'))).toBeUndefined();
  });

  it('returns nothing for empty transcripts', () => {
    expect(summarize([])).toEqual({ keyPoints: [], keywords: [], summaryText: '', sourceCount: 0 });
  });
});

describe('export formatters', () => {
  const segments = [
    seg(0, 0, 'Please share the latest build.', 'Please latest build share karein.'),
    seg(1, 65_500, 'I will test it.', 'Main ise test karunga.', { correctedHinglish: 'Main test kar dunga.', endMs: null }),
    seg(2, 70_000, 'Untranslated line.', null, { state: 'failed' }),
  ];

  it('TXT includes metadata, both languages, corrections and gaps', () => {
    const txt = toTxt(meeting, segments, 'both');
    expect(txt).toContain('Meeting: Weekly Standup <Q3>');
    expect(txt).toContain('[0:00] Please share the latest build.');
    expect(txt).toContain('Main test kar dunga.');
    expect(txt).not.toContain('Main ise test karunga.');
    expect(txt).toContain('(translation unavailable)');
    expect(txt).toContain('Machine transcription');
  });

  it('SRT has sequential cues with valid timestamps and inferred end times', () => {
    const srt = toSrt(segments, 'hinglish');
    expect(srt.startsWith('1\n00:00:00,000 --> 00:00:02,000\nPlease latest build share karein.')).toBe(true);
    expect(srt).toContain('2\n00:01:05,500 --> 00:01:09,950\nMain test kar dunga.');
    expect(srt).toContain('3\n00:01:10,000 --> 00:01:12,000\nUntranslated line.');
  });

  it('HTML escapes content and supports two-column layout', () => {
    const html = toHtml(meeting, segments, { content: 'both', layout: 'columns' });
    expect(html).toContain('Weekly Standup &lt;Q3&gt;');
    expect(html).toContain('<th>Hinglish</th>');
    expect(html).toContain('Translation unavailable');
  });

  it('produces safe file names', () => {
    expect(safeFileName('Weekly: Standup/Q3?', 'txt')).toBe('Weekly_StandupQ3.txt');
    expect(safeFileName('***', 'pdf')).toBe('meeting.pdf');
  });

  it('formats clocks', () => {
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatSrtTime(3_725_042)).toBe('01:02:05,042');
  });
});

describe('TranslationQueue', () => {
  const job = (i: number, meetingId = 'm'): TranslationJob => ({ segmentId: `s${i}`, meetingId, english: `t${i}` });

  it('runs jobs serially in order', async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const q = new TranslationQueue({
      run: async (j) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        order.push(j.segmentId);
        active--;
      },
    });
    [1, 2, 3].forEach((i) => q.enqueue(job(i)));
    await q.drain();
    expect(order).toEqual(['s1', 's2', 's3']);
    expect(maxActive).toBe(1);
    expect(q.getStats().processed).toBe(3);
  });

  it('bounds the backlog and reports dropped jobs instead of losing them silently', async () => {
    const dropped: string[] = [];
    let release: () => void = () => {};
    const q = new TranslationQueue({
      maxBacklog: 2,
      run: () => new Promise<void>((r) => (release = r)),
      onDrop: (j) => dropped.push(j.segmentId),
    });
    [1, 2, 3, 4, 5].forEach((i) => q.enqueue(job(i)));
    // s1 is running; backlog holds 2 newest; s2 and s3 are evicted
    expect(dropped).toEqual(['s2', 's3']);
    expect(q.getStats().dropped).toBe(2);
    release();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await new Promise((r) => setTimeout(r, 0));
    release();
    await q.drain();
  });

  it('cancels pending jobs for a meeting and records failures', async () => {
    const ran: string[] = [];
    const errors: string[] = [];
    const q = new TranslationQueue({
      run: async (j) => {
        ran.push(j.segmentId);
        if (j.segmentId === 's1') throw new Error('boom');
      },
      onError: (j) => errors.push(j.segmentId),
    });
    q.enqueue(job(1));
    q.enqueue(job(2, 'other'));
    q.enqueue(job(3, 'other'));
    q.cancelMeeting('other');
    await q.drain();
    expect(ran).toEqual(['s1']);
    expect(errors).toEqual(['s1']);
    expect(q.getStats().failed).toBe(1);
  });
});

describe('model manifest', () => {
  it('has verified checksums, sizes and role files for every model', () => {
    for (const m of ASR_MODELS) {
      expect(m.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.archiveBytes).toBeGreaterThan(1_000_000);
      expect(m.url.startsWith('https://')).toBe(true);
      const names = m.files.map((f) => f.name);
      for (const role of Object.values(m.roles)) expect(names).toContain(role);
      expect(extractedBytes(m)).toBeGreaterThan(m.archiveBytes * 0.5);
    }
    expect(ASR_MODELS.filter((m) => m.recommended)).toHaveLength(1);
  });
});
