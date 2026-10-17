import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const PALETTE: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.forest, fg: '#fff', border: colors.forest },
  secondary: { bg: '#fff', fg: colors.forest, border: colors.forest },
  ghost: { bg: 'transparent', fg: colors.forest, border: 'transparent' },
  danger: { bg: '#fff', fg: colors.danger, border: colors.danger },
  whatsapp: { bg: colors.whatsapp, fg: '#fff', border: colors.whatsapp },
};

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, compact, style, accessibilityLabel, accessibilityHint }: Props) {
  const p = PALETTE[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: p.bg, borderColor: p.border, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={p.fg} size="small" />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 16 : 18} color={p.fg} />
        ) : null}
        <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[styles.text, compact && styles.textCompact, { color: p.fg }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: fonts.semibold, fontSize: 15 },
  textCompact: { fontSize: 13 },
});
