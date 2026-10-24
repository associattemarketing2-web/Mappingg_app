import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { openUrl } from '@/lib/openLink';
import { Logo, StatusBadge } from '@/components/ProjectBits';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { mapStatusLabel } from '@/constants/status';
import { colors, fonts, radius } from '@/constants/theme';
import { isFieldOn, isPublicCustomField } from '@/lib/fieldVisibility';
import { youtubeId, youtubeWatchUrl } from '@/lib/youtube';
import { usePins } from '@/hooks/usePublicData';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useCompare } from '@/hooks/useSavedList';
import { isBuyer, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { withWidth } from '@/services/publicData';
import type { Pin, VisibilityField } from '@/types/models';

// A buyer's side-by-side compare table (website: the map's compare modal).
// Only fields the public card shows are compared, and only where visible.

const ROWS: { label: string; field?: VisibilityField; value(p: Pin): string }[] = [
  { label: 'Developer', field: 'developer', value: (p) => p.developer },
  { label: 'Location', field: 'location', value: (p) => p.location },
  { label: 'Property Type', field: 'type', value: (p) => p.type },
  { label: 'RERA No.', field: 'rera', value: (p) => p.reraNumber },
  { label: 'Configuration', field: 'configuration', value: (p) => p.configuration },
  { label: 'Carpet Area', field: 'configuration', value: (p) => p.sqft },
  { label: 'Starting Price', field: 'price', value: (p) => p.price },
  { label: 'Possession / Launch', field: 'possession', value: (p) => (p.status === 'upcoming' ? (p.launchDate ? `Launching: ${p.launchDate}` : '') : p.possessionTimeline) },
  { label: 'Key USP', field: 'key_usp', value: (p) => p.keyUsp },
];
const COL = 168;

export default function CompareScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, status } = useAuth();
  const pinsQ = usePins();
  const compare = useCompare(toast);
  const { enquireAbout } = useProjectActions();

  if (status !== 'signedIn' || !isBuyer(user)) {
    return <EmptyState icon="git-compare-outline" title="Compare is for buyer accounts" text="Sign in with a buyer account to compare up to 3 projects side by side." action={{ title: 'Sign in', onPress: () => router.push('/auth/sign-in') }} />;
  }
  if (compare.isPending || pinsQ.isPending) return <LoadingState />;
  if (compare.isError) return <ErrorState error={compare.error} onRetry={() => void compare.refetch()} />;

  const list = compare.pins.map((id) => pinsQ.data?.find((p) => p.id === id)).filter((p): p is Pin => !!p);
  if (!list.length) {
    return <EmptyState icon="git-compare-outline" title="Your compare list is empty" text="Open a project and tap Compare to add it (up to 3)." action={{ title: 'Browse projects', onPress: () => router.push('/projects') }} />;
  }

  const cell = (p: Pin, field: VisibilityField | undefined, v: string) => (field && !isFieldOn(p, field)) || !v ? '—' : v;
  const rows = ROWS.filter((r) => list.some((p) => cell(p, r.field, r.value(p)) !== '—'));
  const customLabels = [...new Set(list.flatMap((p) => p.customFields.filter((c) => c.visible !== false && c.label && c.value && isPublicCustomField(c)).map((c) => c.label!)))];

  return (
    <Screen>
      <AppText variant="caption">
        {list.length} of {compare.max} projects
      </AppText>
      {list.length < 2 ? <AppText style={styles.note}>Add at least one more project to compare side by side.</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.table}>
        <View>
          <View style={styles.row}>
            <View style={styles.labelCell} />
            {list.map((p) => (
              <View key={p.id} style={[styles.cell, styles.head]}>
                <Logo uri={withWidth(p.image, 160)} size={52} />
                <Text style={styles.title} numberOfLines={3}>
                  {p.title}
                </Text>
                <Pressable onPress={() => compare.toggle(p.id)} accessibilityRole="button" accessibilityLabel={`Remove ${p.title} from compare`} style={styles.remove} hitSlop={6}>
                  <Ionicons name="close" size={16} color={colors.danger} />
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.row}>
            <Text style={styles.labelCell}>Status</Text>
            {list.map((p) => (
              <View key={p.id} style={styles.cell}>
                {isFieldOn(p, 'status') ? <StatusBadge status={p.status} label={mapStatusLabel(p.status)} /> : <Text style={styles.value}>—</Text>}
              </View>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.labelCell}>{r.label}</Text>
              {list.map((p) => (
                <Text key={p.id} style={[styles.cell, styles.value]}>
                  {cell(p, r.field, r.value(p))}
                </Text>
              ))}
            </View>
          ))}
          {customLabels.map((label) => (
            <View key={label} style={styles.row}>
              <Text style={styles.labelCell}>{label}</Text>
              {list.map((p) => (
                <Text key={p.id} style={[styles.cell, styles.value]}>
                  {p.customFields.find((c) => c.visible !== false && c.label === label && c.value && isPublicCustomField(c))?.value || '—'}
                </Text>
              ))}
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.labelCell}>Project Video</Text>
            {list.map((p) => {
              const v = youtubeId(p.youtubeVideoUrl);
              return v ? (
                <Pressable key={p.id} style={styles.cell} onPress={() => void openUrl(youtubeWatchUrl(v))} accessibilityRole="link">
                  <Text style={styles.link}>▶ Watch video</Text>
                </Pressable>
              ) : (
                <Text key={p.id} style={[styles.cell, styles.value]}>
                  —
                </Text>
              );
            })}
          </View>
          <View style={styles.row}>
            <View style={styles.labelCell} />
            {list.map((p) => (
              <View key={p.id} style={[styles.cell, styles.actions]}>
                <Button title="View on map" compact onPress={() => router.navigate({ pathname: '/', params: { pin: p.id } })} />
                {isFieldOn(p, 'enquire') ? <Button title="Enquire" compact variant="secondary" onPress={() => void enquireAbout(p)} /> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <Button title="Clear all" variant="danger" icon="trash-outline" onPress={() => compare.setPins([])} style={styles.clear} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 6 },
  table: { paddingVertical: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  labelCell: { width: 104, paddingVertical: 10, paddingRight: 8, fontFamily: fonts.semibold, fontSize: 12, color: colors.goldDeep },
  cell: { width: COL, paddingVertical: 10, paddingHorizontal: 8 },
  head: { alignItems: 'flex-start', gap: 6 },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  removeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
  value: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.ink },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
  actions: { gap: 6 },
  clear: { marginTop: 8, borderRadius: radius.md },
});
