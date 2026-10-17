import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { callUrl, whatsappGeneralUrl } from '@/constants/contact';
import { STATUS_COLOR, STATUS_MAP_LABEL, type PinStatus } from '@/constants/status';
import { colors, fonts, radius, shadow, TOUCH } from '@/constants/theme';
import type { Suggestion } from '@/lib/search';
import type { Basemap } from './LiveMap';

export function SearchBar({
  value,
  onChange,
  suggestions,
  onPick,
  onClear,
}: {
  value: string;
  onChange(v: string): void;
  suggestions: Suggestion[];
  onPick(s: Suggestion): void;
  onClear(): void;
}) {
  return (
    <View>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Where do you want to buy? Try Mundhwa, Kharadi…"
          placeholderTextColor="#8a938f"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search projects, locations or configurations"
          maxFontSizeMultiplier={1.3}
        />
        {value ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} style={styles.clear}>
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {suggestions.length ? (
        <View style={styles.suggestions}>
          <FlatList
            data={suggestions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(s, i) => `${s.type}-${s.label}-${i}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.sugg, pressed && { backgroundColor: colors.land }]} accessibilityRole="button" accessibilityLabel={`${item.label}, ${item.type}`}>
                <Text style={styles.suggText} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.suggType}>{item.type}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const BASEMAP_NEXT: Record<Basemap, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  map: { icon: 'earth-outline', label: 'Satellite' },
  satellite: { icon: 'moon-outline', label: 'Night' },
  night: { icon: 'map-outline', label: 'Map' },
};

export function Toolbar({
  basemap,
  onBasemap,
  onNearMe,
  locating,
}: {
  basemap: Basemap;
  onBasemap(): void;
  onNearMe(): void;
  locating: boolean;
}) {
  const next = BASEMAP_NEXT[basemap];
  return (
    <View style={styles.toolbar}>
      <Pill icon={next.icon} label={next.label} onPress={onBasemap} a11y={`Switch to ${next.label.toLowerCase()} view`} />
      <Pill icon="locate" label={locating ? 'Locating…' : 'Near me'} onPress={onNearMe} a11y="Show projects near your current location" />
    </View>
  );
}

function Pill({ icon, label, onPress, a11y }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void; a11y: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={16} color={colors.mapInk} />
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

export function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.legend}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Legend" style={styles.legendHead}>
        <Text style={styles.legendTitle}>Legend</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mapInk} />
      </Pressable>
      {open ? (
        <View style={styles.legendBody}>
          {(Object.keys(STATUS_COLOR) as PinStatus[]).map((s) => (
            <View key={s} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: STATUS_COLOR[s] }]} />
              <Text style={styles.legendText}>{STATUS_MAP_LABEL[s]}</Text>
            </View>
          ))}
          <Text style={styles.legendNote}>Tap a pin to see the project card.</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SideButtons({ onZoomIn, onZoomOut }: { onZoomIn(): void; onZoomOut(): void }) {
  return (
    <View style={styles.side}>
      <Round icon="logo-whatsapp" bg={colors.whatsapp} fg="#fff" label="Chat on WhatsApp" onPress={() => Linking.openURL(whatsappGeneralUrl()).catch(() => undefined)} />
      <Round icon="call" bg={colors.forest} fg="#fff" label="Call us" onPress={() => Linking.openURL(callUrl()).catch(() => undefined)} />
      <View style={styles.zoom}>
        <Pressable onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in" style={styles.zoomBtn}>
          <Ionicons name="add" size={22} color={colors.mapInk} />
        </Pressable>
        <View style={styles.zoomSep} />
        <Pressable onPress={onZoomOut} accessibilityRole="button" accessibilityLabel="Zoom out" style={styles.zoomBtn}>
          <Ionicons name="remove" size={22} color={colors.mapInk} />
        </Pressable>
      </View>
    </View>
  );
}

function Round({ icon, bg, fg, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; label: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.round, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH,
    paddingLeft: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.97)',
    ...shadow.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.mapInk, paddingVertical: 10 },
  clear: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  suggestions: { marginTop: 6, maxHeight: 300, backgroundColor: '#fff', borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  sugg: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  suggText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.mapInk },
  suggType: { fontFamily: fonts.semibold, fontSize: 11, color: colors.goldDeep, textTransform: 'uppercase' },
  toolbar: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...shadow.card,
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.mapInk },
  legend: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.md, ...shadow.card },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12 },
  legendTitle: { fontFamily: fonts.display, fontSize: 14, color: colors.mapInk },
  legendBody: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  legendText: { fontFamily: fonts.medium, fontSize: 13, color: colors.mapInk },
  legendNote: { fontFamily: fonts.regular, fontSize: 12, color: '#9a8f7a', maxWidth: 180 },
  side: { position: 'absolute', right: 12, bottom: 20, gap: 10, alignItems: 'center' },
  round: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  zoom: { backgroundColor: '#fff', borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  zoomBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  zoomSep: { height: 1, backgroundColor: colors.line },
});
