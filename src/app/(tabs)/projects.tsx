import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProjectCard } from '@/components/ProjectCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { STATUS_ROUTES } from '@/constants/status';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { cityOf, typeGroups } from '@/lib/entities';
import { CITY_LABELS, type CityKey } from '@/lib/city';
import { matchesText } from '@/lib/search';
import { useProjects } from '@/hooks/usePublicData';
import { slugify } from '@/lib/slug';
import type { Pin } from '@/types/models';

type Sort = 'number' | 'newest' | 'name';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'number', label: 'Default order' },
  { value: 'newest', label: 'Recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
];

export default function ProjectsScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { projects, isPending, isError, error, refetch, isRefetching } = useProjects();
  const [query, setQuery] = useState(params.q || '');
  const [status, setStatus] = useState<string>('all');
  const [city, setCity] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('number');
  const [sheet, setSheet] = useState<'city' | 'type' | 'sort' | null>(null);

  const cities = useMemo(() => {
    const keys = new Set<CityKey>(projects.map(cityOf));
    return [{ value: 'all', label: 'All cities' }, ...[...keys].map((k) => ({ value: k, label: CITY_LABELS[k] }))];
  }, [projects]);
  const types = useMemo(() => [{ value: 'all', label: 'All property types' }, ...typeGroups(projects).map((g) => ({ value: g.slug, label: `${g.label} (${g.count})` }))], [projects]);

  const list = useMemo(() => {
    const route = STATUS_ROUTES.find((r) => r.slug === status);
    const out = projects.filter((p: Pin) => {
      if (route && !(route.match as readonly string[]).includes(p.status)) return false;
      if (status === 'sold' && p.status !== 'sold') return false;
      if (city !== 'all' && cityOf(p) !== city) return false;
      if (type !== 'all' && slugify(p.type) !== type) return false;
      return matchesText(p, query);
    });
    if (sort === 'name') out.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'newest') out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    else out.sort((a, b) => a.number - b.number);
    return out;
  }, [projects, status, city, type, sort, query]);

  if (isPending) return <LoadingState label="Loading projects…" />;
  if (isError && !projects.length) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const statusChips = [{ slug: 'all', label: 'All' }, ...STATUS_ROUTES.map((r) => ({ slug: r.slug, label: r.label })), { slug: 'sold', label: 'Sold' }];
  const filtersOn = status !== 'all' || city !== 'all' || type !== 'all' || !!query;

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProjectCard pin={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} colors={[colors.forest]} tintColor={colors.forest} />}
        ListHeaderComponent={
          <View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by project, area, developer or BHK"
                placeholderTextColor="#8a938f"
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search projects"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {statusChips.map((c) => (
                <Pressable
                  key={c.slug}
                  onPress={() => setStatus(c.slug)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: status === c.slug }}
                  style={[styles.chip, status === c.slug && styles.chipOn]}
                >
                  <Text style={[styles.chipText, status === c.slug && styles.chipTextOn]}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.row}>
              <FilterButton label={cities.find((c) => c.value === city)?.label || 'City'} onPress={() => setSheet('city')} active={city !== 'all'} />
              <FilterButton label={type === 'all' ? 'Property type' : types.find((t) => t.value === type)?.label.replace(/ \(\d+\)$/, '') || 'Type'} onPress={() => setSheet('type')} active={type !== 'all'} />
              <FilterButton label={SORTS.find((s) => s.value === sort)!.label} icon="swap-vertical" onPress={() => setSheet('sort')} />
            </View>
            <View style={styles.countRow}>
              <Text style={styles.count} accessibilityLiveRegion="polite">
                {list.length} of {projects.length} projects
              </Text>
              {filtersOn ? (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setStatus('all');
                    setCity('all');
                    setType('all');
                  }}
                  accessibilityRole="button"
                  hitSlop={10}
                >
                  <Text style={styles.reset}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No projects match" text="Try a different search or clear the filters." />}
      />
      <OptionSheet visible={sheet === 'city'} title="City" options={cities} selected={city} onSelect={setCity} onClose={() => setSheet(null)} />
      <OptionSheet visible={sheet === 'type'} title="Property type" options={types} selected={type} onSelect={setType} onClose={() => setSheet(null)} />
      <OptionSheet visible={sheet === 'sort'} title="Sort by" options={SORTS} selected={sort} onSelect={(v) => setSort(v as Sort)} onClose={() => setSheet(null)} />
    </View>
  );
}

function FilterButton({ label, onPress, active, icon = 'chevron-down' }: { label: string; onPress(): void; active?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Opens filter options" style={[styles.filter, active && styles.chipOn]}>
      <Text style={[styles.filterText, active && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name={icon} size={14} color={active ? colors.forest : colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.land },
  list: { padding: 16, paddingBottom: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH,
    paddingLeft: 14,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  clear: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.forestTint, borderColor: colors.forest },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.forest, fontFamily: fonts.semibold },
  row: { flexDirection: 'row', gap: 8 },
  filter: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  reset: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
});
