import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { asPinStatus, listStatusLabel } from '@/constants/status';
import { colors, fonts, radius, type } from '@/constants/theme';
import { shown } from '@/lib/fieldVisibility';
import { withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';

// Pieces shared by the front page (welcome) and the signed-in home screen.

export const PAGE_BG = '#f4faf7';

/** Soft mint → white wash behind the top of a page. */
export function PageBackground() {
  return <View style={styles.pageBg} pointerEvents="none" />;
}

/** Mappingg mark + wordmark (+ optional tagline). */
export function Brand({ tagline }: { tagline?: boolean }) {
  return (
    <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Mappingg">
      <Image source={require('@assets/images/mappingg-mark.png')} style={styles.mark} contentFit="contain" />
      <View>
        <Text style={styles.word}>Mappingg</Text>
        {tagline ? <Text style={styles.tagline}>Explore · Discover · Invest</Text> : null}
      </View>
    </View>
  );
}

/** Yellow hand-drawn underline used under accent words. */
export function Swoosh({ width = 120, style }: { width?: number; style?: object }) {
  return <View style={[styles.swoosh, { width }, style]} />;
}

export function SectionHead({ title, action, onAction, swoosh }: { title: string; action?: string; onAction?(): void; swoosh?: boolean }) {
  return (
    <View style={styles.sectionHead}>
      <View>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {swoosh ? <Swoosh width={64} style={styles.sectionSwoosh} /> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="link" style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.forest} />
        </Pressable>
      ) : null}
    </View>
  );
}

const STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  available: { bg: '#e2f4ea', fg: '#1b7347' },
  construction: { bg: '#fdf0d2', fg: '#94610f' },
  upcoming: { bg: '#e3edfa', fg: '#2b5d96' },
  sold: { bg: '#fbe4e4', fg: '#9f383c' },
};

export const CARD_WIDTH = 228;

/** Featured project card: real project photo, HOT badge, status, price. */
export function FeaturedProjectCard({
  pin,
  onPress,
  favorite,
}: {
  pin: Pin;
  onPress(): void;
  /** Shown only when the account can keep favourites. */
  favorite?: { on: boolean; toggle(): void };
}) {
  const [failed, setFailed] = useState(false);
  const price = shown(pin, 'price', pin.price);
  const tint = STATUS_TINT[asPinStatus(pin.status)]!;
  const img = withWidth(pin.brochureImage || pin.image, 600);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pin.title}, ${pin.locality}${price ? `, ${price}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        {img && !failed ? (
          <>
            {/* Blurred copy fills the frame; the sharp image sits on top uncropped,
                so both photos and logos look right. */}
            <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={18} cachePolicy="memory-disk" />
            <Image
              source={{ uri: img }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={200}
              onError={() => setFailed(true)}
              cachePolicy="memory-disk"
            />
          </>
        ) : (
          <View style={styles.coverEmpty}>
            <Ionicons name="business" size={44} color={colors.forest} />
          </View>
        )}
        {pin.highlighted ? (
          <View style={styles.badge}>
            <Ionicons name="flame" size={13} color="#f03e3e" />
            <Text style={styles.badgeText}>HOT</Text>
          </View>
        ) : null}
        {favorite ? (
          <Pressable
            onPress={favorite.toggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite.on ? 'Remove from favourites' : 'Add to favourites'}
            style={styles.heart}
          >
            <Ionicons name={favorite.on ? 'heart' : 'heart-outline'} size={18} color={favorite.on ? '#e03131' : colors.water} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {pin.title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={13} color={colors.park} />
          <Text style={styles.meta} numberOfLines={1}>
            {[pin.locality, pin.developer].filter(Boolean).join(' · ') || 'Real estate project'}
          </Text>
        </View>
        <View style={[styles.status, { backgroundColor: tint.bg }]}>
          <Text style={[styles.statusText, { color: tint.fg }]} numberOfLines={1}>
            {listStatusLabel(pin.status)}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {price ? (/^\d/.test(price) ? `₹ ${price}` : price) : 'Price on request'}
          </Text>
          <View style={styles.go}>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  // Built-in CSS gradients (React Native New Architecture) — no extra native module needed.
  pageBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 520,
    backgroundImage: `linear-gradient(180deg, #dff1ea 0%, #eef7f3 35%, ${PAGE_BG} 100%)`,
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 44 },
  word: { fontFamily: fonts.extrabold, fontSize: 25, lineHeight: 30, letterSpacing: -0.8, color: colors.forestDeep },
  tagline: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.2, color: colors.muted },

  swoosh: { height: 4, borderRadius: 2, backgroundColor: '#f5b70a', transform: [{ rotate: '-3deg' }] },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 32, marginBottom: 14 },
  sectionTitle: { ...type.h2, color: colors.ink },
  sectionSwoosh: { position: 'absolute', right: -40, bottom: -4 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 3 },
  sectionActionText: { ...type.small, fontFamily: fonts.semibold, color: colors.forest },

  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#0f3d30',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cover: { height: 128, backgroundColor: colors.forestTint, overflow: 'hidden' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundImage: 'linear-gradient(135deg, #d7eee3, #bfe0d1)' },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
  },
  badgeText: { ...type.tiny, fontFamily: fonts.bold, letterSpacing: 0.4, color: '#e03131' },
  heart: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  title: { ...type.h3, color: colors.ink },
  metaRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  status: { marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { ...type.tiny, fontFamily: fonts.medium },
  priceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  price: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.forestDeep },
  go: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
});
