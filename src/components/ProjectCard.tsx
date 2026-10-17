import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listStatusLabel } from '@/constants/status';
import { colors, fonts, radius, shadow } from '@/constants/theme';
import { isFieldOn, shown } from '@/lib/fieldVisibility';
import { withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';
import { Chip, Logo, StatusBadge } from './ProjectBits';

/** A project in a list (website: components/seo/ProjectCard.tsx). */
export const ProjectCard = memo(function ProjectCard({ pin, right }: { pin: Pin; right?: React.ReactNode }) {
  const router = useRouter();
  const meta = [shown(pin, 'developer', pin.developer), shown(pin, 'location', pin.locality)].filter(Boolean).join(' · ') || 'Real estate project';
  const usp = shown(pin, 'key_usp', pin.keyUsp);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/project/[slug]', params: { slug: pin.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${pin.title}. ${meta}. ${listStatusLabel(pin.status)}`}
      accessibilityHint="Opens the project details"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Logo uri={withWidth(pin.image, 160)} size={60} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {isFieldOn(pin, 'name') ? pin.title : 'Project'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {usp ? (
          <Text style={styles.usp} numberOfLines={2}>
            {usp}
          </Text>
        ) : null}
        <View style={styles.chips}>
          {pin.status && isFieldOn(pin, 'status') ? <StatusBadge status={pin.status} label={listStatusLabel(pin.status)} /> : null}
          {pin.type && isFieldOn(pin, 'type') ? <Chip text={pin.type} /> : null}
          {pin.configuration && isFieldOn(pin, 'configuration') ? <Chip text={pin.configuration} tone="green" /> : null}
        </View>
        {shown(pin, 'price', pin.price) ? (
          <Text style={styles.price} numberOfLines={1}>
            {pin.price}
          </Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} style={styles.chevron} />}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.ink },
  meta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  usp: { marginTop: 6, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  price: { marginTop: 8, fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },
  chevron: { alignSelf: 'center' },
});
