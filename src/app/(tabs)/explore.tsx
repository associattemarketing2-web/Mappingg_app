import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo } from '@/components/ProjectBits';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { cityOf, cityGroups, developerGroups, localityGroups, statusGroups, typeGroups, type Group } from '@/lib/entities';
import { CITY_LABELS, type CityKey } from '@/lib/city';
import { useDeveloperLogos, useProjects } from '@/hooks/usePublicData';

type Tab = 'localities' | 'developers' | 'more';

/** Cities, localities, developers, statuses and property types — the website's hub pages. */
export default function ExploreScreen() {
  const router = useRouter();
  const { projects, isPending, isError, error, refetch, isRefetching } = useProjects();
  const logos = useDeveloperLogos();
  const [tab, setTab] = useState<Tab>('localities');
  const [filter, setFilter] = useState('');

  const groups = useMemo(
    () => ({
      cities: cityGroups(projects),
      localities: localityGroups(projects),
      developers: developerGroups(projects),
      statuses: statusGroups(projects),
      types: typeGroups(projects),
    }),
    [projects],
  );

  if (isPending) return <LoadingState />;
  if (isError && !projects.length) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const open = (g: Group) => router.push({ pathname: '/browse/[kind]/[slug]', params: { kind: g.kind, slug: g.slug } });
  const f = filter.trim().toLowerCase();
  const match = (g: Group) => !f || g.label.toLowerCase().includes(f);

  // Localities split by city, like the website's /locations page.
  const byCity = new Map<CityKey, Group[]>();
  for (const g of groups.localities.filter(match)) {
    const key = g.pins[0] ? cityOf(g.pins[0]) : 'pune';
    byCity.set(key, [...(byCity.get(key) || []), g]);
  }

  return (
    <Screen refreshing={isRefetching} onRefresh={() => void refetch()} background={colors.land}>
      <View style={styles.cities}>
        {groups.cities.map((c) => (
          <Pressable key={c.slug} onPress={() => open(c)} style={styles.city} accessibilityRole="button" accessibilityLabel={`${c.label}, ${c.count} projects`}>
            <Text style={styles.cityName}>{c.label}</Text>
            <Text style={styles.cityCount}>{c.count} projects</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['localities', 'developers', 'more'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'localities' ? `Localities (${groups.localities.length})` : t === 'developers' ? `Developers (${groups.developers.length})` : 'Status & type'}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== 'more' ? (
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder={tab === 'localities' ? 'Find a locality' : 'Find a developer'}
          placeholderTextColor="#8a938f"
          style={styles.filter}
          accessibilityLabel={tab === 'localities' ? 'Find a locality' : 'Find a developer'}
        />
      ) : null}

      {tab === 'localities'
        ? [...byCity.entries()].map(([city, list]) => (
            <View key={city} style={styles.section}>
              <AppText variant="heading" style={styles.sectionTitle}>
                {CITY_LABELS[city]}
              </AppText>
              <View style={styles.grid}>
                {list.map((g) => (
                  <GroupTile key={g.slug} group={g} onPress={() => open(g)} />
                ))}
              </View>
            </View>
          ))
        : null}

      {tab === 'developers' ? (
        <View style={styles.grid}>
          {groups.developers.filter(match).map((g) => (
            <GroupTile key={g.slug} group={g} onPress={() => open(g)} logo={logos.get(g.slug) || null} />
          ))}
        </View>
      ) : null}

      {tab === 'more' ? (
        <>
          <AppText variant="heading" style={styles.sectionTitle}>
            By status
          </AppText>
          <View style={styles.grid}>
            {groups.statuses.map((g) => (
              <GroupTile key={g.slug} group={g} onPress={() => open(g)} />
            ))}
          </View>
          <AppText variant="heading" style={[styles.sectionTitle, styles.gapTop]}>
            By property type
          </AppText>
          <View style={styles.grid}>
            {groups.types.map((g) => (
              <GroupTile key={g.slug} group={g} onPress={() => open(g)} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function GroupTile({ group, onPress, logo }: { group: Group; onPress(): void; logo?: string | null }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.label}, ${group.count} project${group.count === 1 ? '' : 's'}`}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      {logo !== undefined ? <Logo uri={logo} size={40} /> : null}
      <View style={styles.flex}>
        <Text style={styles.tileTitle} numberOfLines={2}>
          {group.label}
        </Text>
        <Text style={styles.tileMeta}>
          {group.count} project{group.count === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cities: { flexDirection: 'row', gap: 10 },
  city: { flex: 1, padding: 16, borderRadius: radius.lg, backgroundColor: colors.forest, minHeight: 84, justifyContent: 'flex-end' },
  cityName: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  cityCount: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 12 },
  tab: { flex: 1, minHeight: TOUCH, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 4 },
  tabOn: { backgroundColor: colors.forestTint, borderColor: colors.forest },
  tabText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text, textAlign: 'center' },
  tabTextOn: { fontFamily: fonts.semibold, color: colors.forest },
  filter: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 12,
  },
  section: { marginBottom: 16 },
  sectionTitle: { marginBottom: 10 },
  gapTop: { marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  tileMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
});
