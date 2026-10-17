import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, TOUCH } from '@/constants/theme';

/** Card for an infrastructure marker or road (metro, bridge, proposed road…). */
export function InfoSheet({
  emoji,
  title,
  type,
  notes,
  color,
  footer,
  onClose,
}: {
  emoji: string;
  title: string;
  type: string;
  notes: string;
  color: string;
  footer?: string;
  onClose(): void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <View style={[styles.header, { backgroundColor: color }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.type}>{type}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close} hitSlop={6}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
      <Text style={[styles.notes, !notes && styles.empty]}>{notes || 'No notes added yet'}</Text>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 6 },
  emoji: { fontSize: 26 },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  type: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  notes: { paddingHorizontal: 16, paddingTop: 12, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mapInk },
  empty: { color: colors.muted, fontStyle: 'italic' },
  footer: { paddingHorizontal: 16, paddingTop: 8, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
});
