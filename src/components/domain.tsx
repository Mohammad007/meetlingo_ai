import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { AudioLevelEvent } from '@/../modules/meetlingo-native';
import { highlightRuns } from '@/database/repositories/search';
import type { DownloadProgress } from '@/stores/modelStore';
import { radius, spacing, TOUCH, useAppTheme } from '@/theme';
import type { CaptionState, OutputMode, TranslationStyle } from '@/types';
import { formatBytes, formatClock } from '@/utils/format';

import { Icon, type IconName } from './Icon';
import { AppText, Button, Card, IconButton, ProgressBar, Row, StatusChip } from './ui';

/* ------------------------------------------------------------------ Logo */

export function Logo({ size = 64, inverted }: { size?: number; inverted?: boolean }) {
  const bubble = inverted ? '#FFFFFF' : '#0EA5E9';
  const bars = inverted ? '#0EA5E9' : '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="MeetLingo AI logo">
      <Path d="M12 6h40a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H28l-12 10v-10h-4a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill={bubble} />
      {[16, 22, 28, 34, 40, 46].map((x, i) => {
        const h = [8, 16, 24, 18, 12, 6][i];
        return <Rect key={x} x={x - 1.5} y={26 - h / 2} width={3} height={h} rx={1.5} fill={bars} />;
      })}
    </Svg>
  );
}

export function Wordmark({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <AppText style={{ fontSize: size, fontWeight: '800', letterSpacing: -0.5 }} color={color}>
      MeetLingo <AppText style={{ fontSize: size, fontWeight: '800' }} color="#0EA5E9">AI</AppText>
    </AppText>
  );
}

/* ------------------------------------------------------------------ Waveform / VU */

/** Rolling level history from throttled native level events (10 Hz). Draws nothing fake: empty until levels arrive. */
export function LiveWaveform({ level, bars = 36, height = 72, active = true }: { level: AudioLevelEvent | null; bars?: number; height?: number; active?: boolean }) {
  const { colors } = useAppTheme();
  const [history, setHistory] = useState<number[]>([]);
  const last = useRef<AudioLevelEvent | null>(null);
  useEffect(() => {
    if (!level || level === last.current) return;
    last.current = level;
    // Map -60..0 dBFS to 0..1
    const v = Math.max(0, Math.min(1, (level.dbfs + 60) / 60));
    setHistory((h) => [...h.slice(-(bars - 1)), v]);
  }, [level, bars]);
  const shown = active ? history : [];
  const w = 6;
  const gap = 4;
  const width = bars * (w + gap);
  const padded = [...Array(Math.max(0, bars - shown.length)).fill(0), ...shown];
  return (
    <View accessibilityLabel={level ? `Input level ${Math.round(level.dbfs)} decibels` : 'No audio level yet'} style={{ alignItems: 'center' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {padded.map((v, i) => {
          const h = Math.max(4, v * height);
          const speechy = v > 0.45;
          return <Rect key={i} x={i * (w + gap)} y={(height - h) / 2} width={w} height={h} rx={3} fill={speechy ? colors.primary : colors.border} />;
        })}
      </Svg>
    </View>
  );
}

export function LevelMeter({ level }: { level: AudioLevelEvent | null }) {
  const { colors } = useAppTheme();
  const v = level ? Math.max(0, Math.min(1, (level.dbfs + 60) / 60)) : 0;
  const color = level?.clipping ? colors.danger : v < 0.25 ? colors.warning : colors.success;
  return <ProgressBar value={v} color={color} />;
}

/* ------------------------------------------------------------------ Captions */

export interface CaptionCardProps {
  startMs: number;
  englishText: string;
  hinglishText: string | null;
  hindiText?: string | null;
  state: CaptionState;
  outputMode: OutputMode;
  translationStyle: TranslationStyle;
  fontSize: number;
  error?: string | null;
  interim?: boolean;
  corrected?: boolean;
  highlight?: string;
  onRetry?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  footer?: ReactNode;
}

/** Bilingual caption card: English (subdued while interim) + stable Hinglish line in sky blue. */
export function CaptionCard(p: CaptionCardProps) {
  const { colors } = useAppTheme();
  const showEnglish = p.outputMode !== 'hinglish' || p.translationStyle === 'english' || p.interim;
  const showTranslated = p.outputMode !== 'english' && p.translationStyle !== 'english' && !p.interim;
  const translated =
    p.translationStyle === 'devanagari' ? p.hindiText ?? null : p.hinglishText;
  const secondary = p.translationStyle === 'dual_language' ? p.hindiText : null;
  const pending = p.state === 'translation_pending' || p.state === 'final';
  const failed = p.state === 'failed';
  const body = (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="caption" color={colors.textMuted}>{formatClock(p.startMs)}</AppText>
        {p.interim ? <StatusChip label="Listening…" tone="neutral" /> : p.corrected ? <StatusChip label="Edited" tone="info" /> : null}
      </Row>
      {showEnglish ? (
        <HighlightText
          text={p.englishText}
          query={p.highlight}
          style={{ fontSize: p.fontSize, lineHeight: p.fontSize * 1.4, color: p.interim ? colors.interim : colors.text, fontStyle: p.interim ? 'italic' : 'normal' }}
        />
      ) : null}
      {showTranslated ? (
        translated ? (
          <>
            <HighlightText
              text={translated}
              query={p.highlight}
              style={{ fontSize: p.fontSize + 1, lineHeight: (p.fontSize + 1) * 1.4, color: colors.hinglish, fontWeight: '700' }}
            />
            {secondary ? <AppText style={{ fontSize: p.fontSize - 1 }} color={colors.textMuted}>{secondary}</AppText> : null}
          </>
        ) : failed ? (
          <Row>
            <AppText variant="caption" color={colors.danger} style={{ flex: 1 }}>Translation unavailable{p.error ? ` — ${p.error}` : ''}</AppText>
            {p.onRetry ? <Button label="Retry" kind="ghost" compact onPress={p.onRetry} icon="refresh" /> : null}
          </Row>
        ) : pending ? (
          <AppText variant="caption" color={colors.textMuted}>Translating on device…</AppText>
        ) : null
      ) : null}
      {p.footer}
    </View>
  );
  return (
    <Pressable
      onPress={p.onPress}
      onLongPress={p.onLongPress}
      disabled={!p.onPress && !p.onLongPress}
      accessibilityRole={p.onPress ? 'button' : undefined}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.interim ? colors.primary : colors.border, borderStyle: p.interim ? 'dashed' : 'solid', padding: spacing.md, marginBottom: spacing.sm }}>
      {body}
    </Pressable>
  );
}

export function HighlightText({ text, query, style }: { text: string; query?: string; style?: object }) {
  if (!query?.trim()) return <AppText style={style} selectable>{text}</AppText>;
  return (
    <AppText style={style} selectable>
      {highlightRuns(text, query).map((r, i) =>
        r.match ? (
          <AppText key={i} style={[style, { backgroundColor: '#FDE68A', color: '#102846' }]}>{r.text}</AppText>
        ) : (
          r.text
        ),
      )}
    </AppText>
  );
}

/* ------------------------------------------------------------------ Mode cards */

export function MeetingModeCard({
  icon,
  title,
  description,
  badge,
  onPress,
  selected,
}: {
  icon: IconName;
  title: string;
  description: string;
  badge?: { label: string; tone: 'warning' | 'success' | 'info' };
  onPress: () => void;
  selected?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title} style={{ marginBottom: spacing.md, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }}>
      <Row style={{ gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={colors.primary} size={24} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>{description}</AppText>
          {badge ? <StatusChip label={badge.label} tone={badge.tone} /> : null}
        </View>
        <Icon name="chevron-right" color={colors.textMuted} size={20} />
      </Row>
    </Card>
  );
}

/* ------------------------------------------------------------------ Models */

export function ModelDownloadRow({
  icon,
  title,
  subtitle,
  sizeLabel,
  status,
  progress,
  onDownload,
  onCancel,
  onDelete,
  busy,
  footnote,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  sizeLabel: string;
  status: 'not_installed' | 'installed' | 'unverified' | 'downloading' | 'error';
  progress?: DownloadProgress;
  onDownload?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  footnote?: string;
}) {
  const { colors } = useAppTheme();
  const pct = progress && progress.totalBytes > 0 ? progress.downloadedBytes / progress.totalBytes : 0;
  const phaseLabel: Record<string, string> = {
    downloading: progress && progress.totalBytes > 0 ? `Downloading… ${Math.round(pct * 100)}% (${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)})` : 'Downloading…',
    verifying: 'Verifying SHA-256 checksum…',
    extracting: 'Extracting and checking files…',
    installed: 'Installed and verified',
    error: progress?.message ?? 'Download failed',
  };
  return (
    <Card style={{ marginBottom: spacing.md, gap: spacing.sm }}>
      <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          {subtitle ? <AppText variant="caption" color={colors.textMuted}>{subtitle}</AppText> : null}
          <AppText variant="caption" color={colors.textMuted}>{sizeLabel}</AppText>
        </View>
        {status === 'installed' ? <StatusChip label="Verified" tone="success" icon="check" /> : null}
        {status === 'unverified' ? <StatusChip label="Needs repair" tone="warning" icon="alert" /> : null}
      </Row>
      {status === 'downloading' && progress ? (
        <View style={{ gap: 6 }}>
          <ProgressBar value={pct} indeterminate={progress.totalBytes <= 0 || progress.phase !== 'downloading'} />
          <AppText variant="caption" color={colors.textMuted}>{phaseLabel[progress.phase] ?? progress.phase}</AppText>
        </View>
      ) : null}
      {status === 'error' && progress ? <AppText variant="caption" color={colors.danger}>{phaseLabel.error}</AppText> : null}
      {footnote ? <AppText variant="caption" color={colors.textMuted}>{footnote}</AppText> : null}
      <Row style={{ justifyContent: 'flex-end' }}>
        {status === 'downloading' && onCancel ? <Button label="Cancel" kind="ghost" compact onPress={onCancel} /> : null}
        {(status === 'not_installed' || status === 'error' || status === 'unverified') && onDownload ? (
          <Button label={status === 'error' ? 'Retry' : status === 'unverified' ? 'Reinstall' : 'Download'} icon={status === 'error' ? 'refresh' : 'download'} compact onPress={onDownload} loading={busy} />
        ) : null}
        {(status === 'installed' || status === 'unverified') && onDelete ? <Button label="Delete" kind="ghost" icon="trash" compact onPress={onDelete} /> : null}
      </Row>
    </Card>
  );
}

/* ------------------------------------------------------------------ Permissions */

export function PermissionExplainCard({
  icon,
  title,
  required,
  description,
  status,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  required: boolean;
  description: string;
  status: 'granted' | 'denied' | 'blocked' | 'unavailable' | 'unknown';
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useAppTheme();
  const chip =
    status === 'granted' ? <StatusChip label="Allowed" tone="success" icon="check" /> : status === 'blocked' ? <StatusChip label="Blocked in settings" tone="danger" /> : status === 'denied' ? <StatusChip label="Not allowed" tone="warning" /> : null;
  return (
    <Card style={{ marginBottom: spacing.md, gap: spacing.sm }}>
      <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
        <Icon name={icon} color={colors.primary} size={24} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">
            {title} <AppText variant="caption" color={required ? colors.danger : colors.textMuted}>({required ? 'Required' : 'Optional'})</AppText>
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>{description}</AppText>
        </View>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        {chip ?? <View />}
        {status !== 'granted' && onAction && actionLabel ? <Button label={actionLabel} compact onPress={onAction} kind={required ? 'primary' : 'secondary'} /> : null}
      </Row>
    </Card>
  );
}

/* ------------------------------------------------------------------ Search bar */

export function TranscriptSearchBar({ value, onChangeText, placeholder = 'Search transcripts', autoFocus }: { value: string; onChangeText: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Row style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: TOUCH }}>
      <Icon name="search" color={colors.textMuted} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 10 }}
      />
      {value ? <IconButton icon="x" label="Clear search" onPress={() => onChangeText('')} size={36} color={colors.textMuted} /> : null}
    </Row>
  );
}

/* ------------------------------------------------------------------ Action bar */

export function ActionBar({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Row style={{ justifyContent: 'space-around', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
      {children}
    </Row>
  );
}

/** Circular control used by the live screen. */
export function RoundControl({ icon, label, onPress, tone = 'neutral', size = 56, disabled }: { icon: IconName; label: string; onPress: () => void; tone?: 'neutral' | 'danger' | 'primary'; size?: number; disabled?: boolean }) {
  const { colors } = useAppTheme();
  const bg = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.primary : colors.surfaceAlt;
  const fg = tone === 'neutral' ? colors.text : '#FFFFFF';
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <IconButton icon={icon} label={label} onPress={onPress} background={bg} color={fg} size={size} disabled={disabled} />
      <AppText variant="label" color={colors.textMuted}>{label}</AppText>
    </View>
  );
}
