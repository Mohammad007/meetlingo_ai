import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getDb } from '@/database/db';
import { getMeeting } from '@/database/repositories/meetings';
import { listSegments } from '@/database/repositories/segments';

import { safeFileName, toHtml, toSrt, toTxt, type ExportContent } from './formatters';

export type ExportFormat = 'txt' | 'srt' | 'pdf';
export type ExportTarget = 'share' | 'save';

export interface ExportRequest {
  meetingId: string;
  format: ExportFormat;
  content: ExportContent;
  layout?: 'columns' | 'stacked';
  includePrivacyNote: boolean;
  target: ExportTarget;
}

export interface ExportResult {
  fileName: string;
  uri: string;
  savedTo?: string;
}

const MIME: Record<ExportFormat, string> = {
  txt: 'text/plain',
  srt: 'application/x-subrip',
  pdf: 'application/pdf',
};

/** Writes the export to the app cache, then shares it (Android share sheet) or saves via the system folder picker (SAF). */
export async function exportMeeting(req: ExportRequest): Promise<ExportResult> {
  const db = getDb();
  const meeting = await getMeeting(db, req.meetingId);
  if (!meeting) throw new Error('Meeting not found');
  const segments = await listSegments(db, req.meetingId);
  if (!segments.length) throw new Error('This meeting has no saved captions to export.');
  const fileName = safeFileName(meeting.title, req.format);

  let cacheFile: File;
  if (req.format === 'pdf') {
    const html = toHtml(meeting, segments, { content: req.content, layout: req.layout, withPrivacyNote: req.includePrivacyNote });
    const { uri } = await Print.printToFileAsync({ html });
    const printed = new File(uri);
    cacheFile = new File(Paths.cache, fileName);
    if (cacheFile.exists) cacheFile.delete();
    printed.move(cacheFile);
  } else {
    const text =
      req.format === 'txt'
        ? toTxt(meeting, segments, req.content, req.includePrivacyNote)
        : toSrt(segments, req.content === 'both' ? 'both' : req.content);
    cacheFile = new File(Paths.cache, fileName);
    if (cacheFile.exists) cacheFile.delete();
    cacheFile.create();
    cacheFile.write(text);
  }

  if (req.target === 'share') {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(cacheFile.uri, { mimeType: MIME[req.format], dialogTitle: `Share ${fileName}` });
    return { fileName, uri: cacheFile.uri };
  }

  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (e) {
    throw new Error(`No folder selected. ${(e as Error).message ?? ''}`.trim());
  }
  try {
    const out = dir.createFile(fileName, MIME[req.format]);
    out.write(await cacheFile.bytes());
    return { fileName, uri: cacheFile.uri, savedTo: out.uri };
  } catch (e) {
    throw new Error(`Could not save to the selected folder (storage permission or space): ${(e as Error).message}`);
  }
}

/** Exports all local data as JSON (for the user's own backup) via the share sheet. */
export async function exportAllDataJson(payload: unknown): Promise<string> {
  const f = new File(Paths.cache, `meetlingo-export-${new Date().toISOString().slice(0, 10)}.json`);
  if (f.exists) f.delete();
  f.create();
  f.write(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Export MeetLingo data' });
  return f.uri;
}

/** Shares a plain-text diagnostics report (no transcript or audio content). */
export async function shareTextFile(name: string, text: string) {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: 'text/plain', dialogTitle: name });
}
