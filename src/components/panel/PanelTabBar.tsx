import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { iconFor, SHORT_LABEL } from './panelTabs';

// The app's bottom bar for the panels: the main tabs, "More", and the account
// (Profile) at the bottom right.

export interface BarItem {
  label: string;
  badge?: string;
}

interface Props {
  items: BarItem[];
  active: string;
  moreBadge?: number;
  showMore: boolean;
  moreActive: boolean;
  profileActive: boolean;
  avatar: string;
  initials: string;
  onPress(label: string): void;
  onMore(): void;
  onProfile(): void;
}

export function PanelTabBar(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {p.items.map((t) => {
        const on = t.label === p.active;
        const ic = iconFor(t.label);
        return (
          <Slot key={t.label} label={SHORT_LABEL[t.label] || t.label} a11y={t.label} on={on} badge={t.badge} onPress={() => p.onPress(t.label)}>
            <Ionicons name={on ? ic.on : ic.off} size={22} color={on ? colors.forest : colors.muted} />
          </Slot>
        );
      })}
      {p.showMore ? (
        <Slot label="More" a11y="More sections" on={p.moreActive} badge={p.moreBadge ? String(p.moreBadge) : undefined} onPress={p.onMore}>
          <Ionicons name={p.moreActive ? 'apps' : 'apps-outline'} size={22} color={p.moreActive ? colors.forest : colors.muted} />
        </Slot>
      ) : null}
      <Slot label="Profile" a11y="Profile and settings" on={p.profileActive} onPress={p.onProfile}>
        <View style={[styles.avatar, p.profileActive && styles.avatarOn]}>
          {p.avatar ? (
            <Image source={{ uri: p.avatar }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{p.initials}</Text>
          )}
        </View>
      </Slot>
    </View>
  );
}

function Slot({ label, a11y, on, badge, onPress, children }: { label: string; a11y: string; on: boolean; badge?: string; onPress(): void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${a11y}, ${badge} new` : a11y}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.slot, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.pill, on && styles.pillOn]}>
        {children}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  slot: { flex: 1, alignItems: 'center', minHeight: 52, justifyContent: 'center', gap: 3 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.forestTint },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, maxWidth: 76 },
  labelOn: { fontFamily: fonts.bold, color: colors.forest },
  badge: {
    position: 'absolute',
    top: -3,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOn: { borderWidth: 2, borderColor: colors.forest },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10 },
});
