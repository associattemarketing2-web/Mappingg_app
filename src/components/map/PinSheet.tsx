import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { whatsappProjectUrl } from '@/constants/contact';
import { mapStatusLabel } from '@/constants/status';
import { colors, fonts, radius, shadow, TOUCH } from '@/constants/theme';
import { isFieldOn, shown, visibleCustomFields } from '@/lib/fieldVisibility';
import { youtubeId, youtubeThumb, youtubeWatchUrl } from '@/lib/youtube';
import { withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';
import { Chip, Logo, StatusBadge } from '../ProjectBits';

// The project card that opens when a pin is tapped — the website's map
// "teaser card": logo + name, developer / location / status / type, then the
// details the admin left visible, the project video, and the actions.

interface Props {
  pin: Pin;
  onClose(): void;
  onEnquire(pin: Pin): void;
  onShare(pin: Pin): void;
  onDetails(pin: Pin): void;
  compare?: { on: boolean; toggle(): void };
  favorite?: { on: boolean; toggle(): void };
  enquiring?: boolean;
}

export function PinSheet({ pin, onClose, onEnquire, onShare, onDetails, compare, favorite, enquiring }: Props) {
  const insets = useSafeAreaInsets();
  const configValue = [pin.configuration, pin.sqft].filter(Boolean).join(' · ');
  const upcoming = pin.status === 'upcoming';
  const possession = upcoming ? (pin.launchDate ? `Launching: ${pin.launchDate}` : '') : pin.possessionTimeline ? `Possession: ${pin.possessionTimeline}` : '';
  const vid = youtubeId(pin.youtubeVideoUrl);

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'rera', label: 'MahaRERA No.', value: shown(pin, 'rera', pin.reraNumber) },
    { key: 'configuration', label: 'Configuration', value: shown(pin, 'configuration', configValue) },
    { key: 'price', label: 'Starting Price', value: shown(pin, 'price', pin.price) },
    { key: 'possession', label: upcoming ? 'Launch' : 'Possession', value: shown(pin, 'possession', possession) },
    { key: 'key_usp', label: 'Key USP', value: shown(pin, 'key_usp', pin.keyUsp) },
    ...visibleCustomFields(pin).map((cf, i) => ({ key: `cf-${cf.id || i}`, label: cf.label || '', value: cf.value || '' })),
  ].filter((r) => r.value);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]} accessibilityViewIsModal={false}>
      <View style={styles.grab} />
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close project card" hitSlop={8} style={styles.close}>
        <Ionicons name="close" size={22} color={colors.ink} />
      </Pressable>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          {pin.image ? <Logo uri={withWidth(pin.image, 300)} size={84} label={`${pin.title} logo`} /> : null}
          <View style={styles.head}>
            {isFieldOn(pin, 'name') ? (
              <Text style={styles.title} accessibilityRole="header">
                {pin.title || 'Untitled project'}
              </Text>
            ) : null}
            {shown(pin, 'developer', pin.developer) ? <Text style={styles.meta}>{pin.developer}</Text> : null}
            {shown(pin, 'location', pin.location) ? <Text style={styles.meta}>{pin.location}</Text> : null}
            <View style={styles.chips}>
              {isFieldOn(pin, 'status') ? <StatusBadge status={pin.status} label={mapStatusLabel(pin.status)} /> : null}
              {shown(pin, 'type', pin.type) ? <Chip text={pin.type} /> : null}
            </View>
          </View>
        </View>

        {rows.length ? (
          <View style={styles.details}>
            {rows.map((r) => (
              <View key={r.key} style={styles.row}>
                {r.label ? <Text style={styles.rowLabel}>{r.label}</Text> : null}
                <Text style={styles.rowValue} selectable>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {vid ? (
          <Pressable
            onPress={() => Linking.openURL(youtubeWatchUrl(vid)).catch(() => undefined)}
            accessibilityRole="link"
            accessibilityLabel="Watch the project video on YouTube"
            style={styles.media}
          >
            <Text style={styles.mediaLabel}>PROJECT VIDEO</Text>
            <View>
              <Image source={{ uri: youtubeThumb(vid) }} style={styles.mediaImg} contentFit="cover" />
              <View style={styles.play}>
                <Ionicons name="play" size={26} color="#fff" />
              </View>
            </View>
          </Pressable>
        ) : pin.brochureImage ? (
          <View style={styles.media}>
            <Text style={styles.mediaLabel}>PROJECT BROCHURE</Text>
            <Image source={{ uri: withWidth(pin.brochureImage, 900) || undefined }} style={styles.mediaImg} contentFit="contain" accessibilityLabel="Project brochure" />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {isFieldOn(pin, 'enquire') ? (
          <Action icon="mail-unread-outline" label={enquiring ? 'Sending…' : 'Enquire'} primary onPress={() => onEnquire(pin)} disabled={enquiring} />
        ) : null}
        {isFieldOn(pin, 'whatsapp') ? (
          <Action icon="logo-whatsapp" label="WhatsApp" color={colors.whatsapp} onPress={() => Linking.openURL(whatsappProjectUrl(pin.title)).catch(() => undefined)} />
        ) : null}
        <Action icon="share-social-outline" label="Share" onPress={() => onShare(pin)} />
        {compare ? <Action icon={compare.on ? 'git-compare' : 'git-compare-outline'} label={compare.on ? 'Added' : 'Compare'} active={compare.on} onPress={compare.toggle} /> : null}
        {favorite ? <Action icon={favorite.on ? 'heart' : 'heart-outline'} label={favorite.on ? 'Saved' : 'Favourite'} active={favorite.on} onPress={favorite.toggle} /> : null}
        <Action icon="information-circle-outline" label="Details" onPress={() => onDetails(pin)} />
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
  active,
  color,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress(): void;
  primary?: boolean;
  active?: boolean;
  color?: string;
  disabled?: boolean;
}): ReactNode {
  const fg = primary ? '#fff' : active ? colors.forest : color || colors.ink;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={({ pressed }) => [styles.action, primary && styles.actionPrimary, active && styles.actionActive, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.actionText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.card,
    elevation: 12,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 8 },
  close: { position: 'absolute', right: 6, top: 4, width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  top: { flexDirection: 'row', gap: 14, paddingRight: 34 },
  head: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.mapInk },
  meta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  details: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 8 },
  row: {},
  rowLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.goldDeep, textTransform: 'uppercase', letterSpacing: 0.4 },
  rowValue: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mapInk },
  media: { marginTop: 14 },
  mediaLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.goldDeep, marginBottom: 6 },
  mediaImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: '#000' },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  action: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  actionPrimary: { backgroundColor: colors.enquire, borderColor: colors.enquire },
  actionActive: { backgroundColor: colors.forestTint, borderColor: colors.forest },
  actionText: { fontFamily: fonts.semibold, fontSize: 13 },
});
