import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { mapStatusLabel, statusColor } from '@/constants/status';
import { colors, fonts, radius } from '@/constants/theme';

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: statusColor(status) }]}>
      <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>
        {label || mapStatusLabel(status)}
      </Text>
    </View>
  );
}

export function Chip({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'green' }) {
  return (
    <View style={[styles.chip, tone === 'green' && styles.chipGreen]}>
      <Text style={[styles.chipText, tone === 'green' && styles.chipTextGreen]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {text}
      </Text>
    </View>
  );
}

/** A project / developer logo with a neutral placeholder when missing or broken. */
export function Logo({ uri, size = 56, style, label }: { uri: string | null | undefined; size?: number; style?: StyleProp<ViewStyle>; label?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.logo, { width: size, height: size }, style]} accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'image' : undefined}>
      {uri && !failed ? (
        <Image source={{ uri }} style={styles.fill} contentFit="contain" transition={150} onError={() => setFailed(true)} cachePolicy="memory-disk" />
      ) : (
        <Ionicons name="business-outline" size={size * 0.45} color={colors.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.land,
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: 220,
  },
  chipGreen: { backgroundColor: colors.park50, borderColor: '#cfe6c6' },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  chipTextGreen: { color: colors.park },
  logo: {
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { width: '86%', height: '86%' },
});
