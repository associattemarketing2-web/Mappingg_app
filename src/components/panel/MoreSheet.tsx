import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/constants/theme';
import type { BarItem } from './PanelTabBar';
import { iconFor } from './panelTabs';

/** Bottom sheet with the panel sections that don't fit in the bottom bar. */
export function MoreSheet({ open, items, active, onPick, onClose }: { open: boolean; items: BarItem[]; active: string; onPick(label: string): void; onClose(): void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grip} />
        <Text style={styles.title}>More</Text>
        <View style={styles.grid}>
          {items.map((t) => {
            const on = t.label === active;
            const ic = iconFor(t.label);
            return (
              <Pressable
                key={t.label}
                onPress={() => onPick(t.label)}
                accessibilityRole="button"
                accessibilityLabel={t.badge ? `${t.label}, ${t.badge} new` : t.label}
                style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
                  <Ionicons name={on ? ic.on : ic.off} size={24} color={on ? '#fff' : colors.forest} />
                  {t.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.tileText} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 14, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '33.33%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: radius.md, gap: 8 },
  tileOn: { backgroundColor: colors.forestTint },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.forestTint, alignItems: 'center', justifyContent: 'center' },
  iconWrapOn: { backgroundColor: colors.forest },
  tileText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10 },
});
