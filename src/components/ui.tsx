import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { TOUCH, radius, spacing, type as typo, useAppTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ Text */

type Variant = keyof typeof typo;
export function AppText({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  selectable,
  accessibilityRole,
}: {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
  accessibilityRole?: 'header' | 'text' | 'link';
}) {
  const { colors } = useAppTheme();
  return (
    <Text
      style={[typo[variant], { color: color ?? colors.text }, style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ Layout */

export function Screen({
  children,
  scroll = true,
  edges = ['bottom', 'left', 'right'],
  padded = true,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const inner = [padded && { padding: spacing.lg }, { maxWidth: 760, width: '100%' as const, alignSelf: 'center' as const }, contentStyle];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: spacing.xxl }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ maxWidth: 760, width: '100%', alignSelf: 'center' }}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors } = useAppTheme();
  const base = { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg };
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Row({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: { label: string; onPress: () => void } }) {
  const { colors } = useAppTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">{children}</AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button" style={{ minHeight: TOUCH, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" color={colors.primary}>{action.label}</AppText>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Divider() {
  const { colors } = useAppTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm }} />;
}

/* ------------------------------------------------------------------ Buttons */

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'navy';

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
  accessibilityHint,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const bg = { primary: colors.primary, secondary: colors.surface, danger: colors.danger, ghost: 'transparent', navy: '#102846' }[kind];
  const fg = { primary: colors.primaryText, secondary: colors.text, danger: '#FFFFFF', ghost: colors.primary, navy: '#FFFFFF' }[kind];
  const border = kind === 'secondary' ? colors.border : 'transparent';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        {
          minHeight: compact ? 40 : TOUCH + 4,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <AppText variant="bodyStrong" color={fg}>{label}</AppText>
    </Pressable>
  );
}

/** Button that shows a spinner while its async handler runs. */
export { Button as LoadingButton };

export function IconButton({
  icon,
  onPress,
  label,
  color,
  background,
  size = TOUCH,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  background?: string;
  size?: number;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? 'transparent',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}>
      <Icon name={icon} color={color ?? colors.text} size={Math.round(size * 0.46)} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Header */

export function AppHeader({
  title,
  subtitle,
  back = true,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.background }}>
      <Row style={{ minHeight: 56, paddingHorizontal: spacing.sm }}>
        {back ? (
          <IconButton icon="chevron-left" label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/home')))} />
        ) : (
          <View style={{ width: spacing.sm }} />
        )}
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header">{title}</AppText>
          {subtitle ? <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>{subtitle}</AppText> : null}
        </View>
        {right}
      </Row>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ Chips / banners */

export type ChipTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'live';

export function StatusChip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const { colors } = useAppTheme();
  const map: Record<ChipTone, [string, string]> = {
    success: [colors.successSurface, colors.success],
    danger: [colors.dangerSurface, colors.danger],
    warning: [colors.warningSurface, colors.warning],
    info: [colors.infoSurface, colors.hinglish],
    neutral: [colors.surfaceAlt, colors.textMuted],
    live: [colors.danger, '#FFFFFF'],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      {tone === 'live' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} /> : icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <AppText variant="label" color={fg}>{label}</AppText>
    </View>
  );
}

export function ErrorBanner({
  title,
  message,
  tone = 'danger',
  action,
  onDismiss,
}: {
  title: string;
  message?: string;
  tone?: 'danger' | 'warning' | 'info' | 'success';
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
}) {
  const { colors } = useAppTheme();
  const bg = { danger: colors.dangerSurface, warning: colors.warningSurface, info: colors.infoSurface, success: colors.successSurface }[tone];
  const fg = { danger: colors.danger, warning: colors.warning, info: colors.hinglish, success: colors.success }[tone];
  const icon: IconName = tone === 'success' ? 'check-circle' : tone === 'info' ? 'info' : 'alert';
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm }}>
      <Icon name={icon} color={fg} size={20} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" color={fg}>{title}</AppText>
        {message ? <AppText variant="caption" color={colors.text}>{message}</AppText> : null}
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={{ minHeight: 36, justifyContent: 'center' }}>
            <AppText variant="bodyStrong" color={fg}>{action.label} ›</AppText>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? <IconButton icon="x" label="Dismiss" onPress={onDismiss} size={36} color={fg} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ Empty / loading */

export function EmptyState({ icon = 'file', title, message, action }: { icon?: IconName; title: string; message?: string; action?: { label: string; onPress: () => void } }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={colors.primary} size={28} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      {message ? <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>{message}</AppText> : null}
      {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: spacing.xxl, alignItems: 'center', gap: spacing.md }} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <AppText color={colors.textMuted}>{label}</AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ Settings rows / form controls */

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const content = (
    <Row style={{ minHeight: 56, paddingVertical: spacing.sm, gap: spacing.md }}>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? colors.dangerSurface : colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={danger ? colors.danger : colors.text}>{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textMuted}>{subtitle}</AppText> : null}
      </View>
      {value ? <AppText variant="caption" color={colors.textMuted}>{value}</AppText> : null}
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null)}
    </Row>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, disabled, icon }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: IconName }) {
  const { colors } = useAppTheme();
  return (
    <SettingsRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; accessibilityLabel?: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.surface : 'transparent', paddingHorizontal: 6 }}>
            <AppText variant="label" color={active ? colors.primary : colors.textMuted} numberOfLines={1}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RadioList<T extends string>({ options, value, onChange }: { options: { value: T; label: string; description?: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: !!o.disabled }}
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: TOUCH, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: colors.surface, opacity: o.disabled ? 0.5 : 1 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? colors.primary : colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
              {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{o.label}</AppText>
              {o.description ? <AppText variant="caption" color={colors.textMuted}>{o.description}</AppText> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6, marginBottom: spacing.md }}>
      <AppText variant="label" color={colors.textMuted}>{label.toUpperCase()}</AppText>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...props}
        style={[
          { minHeight: TOUCH, borderWidth: 1, borderColor: error ? colors.danger : colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: 16 },
          props.multiline && { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : hint ? <AppText variant="caption" color={colors.textMuted}>{hint}</AppText> : null}
    </View>
  );
}

export function ProgressBar({ value, color, indeterminate }: { value: number; color?: string; indeterminate?: boolean }) {
  const { colors } = useAppTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ height: 8, width: indeterminate ? '35%' : `${pct * 100}%`, backgroundColor: color ?? colors.primary, borderRadius: 4 }} />
    </View>
  );
}

/* ------------------------------------------------------------------ Dialog */

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
  children,
  loading,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <AppText variant="title" accessibilityRole="header">{title}</AppText>
          {message ? <AppText color={colors.textMuted}>{message}</AppText> : null}
          {children}
          <Row style={{ justifyContent: 'flex-end', marginTop: spacing.sm }}>
            <Button label={cancelLabel} kind="ghost" onPress={onCancel} compact />
            <Button label={confirmLabel} kind={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} compact />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
