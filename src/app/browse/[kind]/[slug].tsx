import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/ProjectBits';
import { ProjectCard } from '@/components/ProjectCard';
import { AppText } from '@/components/ui/AppText';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { cityOf, findGroup, isGroupKind, KIND_TITLES, localityGroups, statusGroups, type Group, type GroupKind } from '@/lib/entities';
import { slugify } from '@/lib/slug';
import { useDeveloperLogos, useProjects } from '@/hooks/usePublicData';

interface Copy {
  title: string;
  lede: string;
  related: { label: string; kind: GroupKind; slug: string; count: number }[];
  relatedTitle: string;
}

function copyFor(g: Group, all: Group['pins']): Copy {
  const locs = (pins: Group['pins']) => {
    const counts = new Map<string, number>();
    for (const p of pins) if (p.locality) counts.set(p.locality, (counts.get(p.locality) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, count]) => ({ label, kind: 'locality' as const, slug: slugify(label), count }));
  };
  switch (g.kind) {
    case 'developer':
      return {
        title: `${g.label} — Projects`,
        lede: `Projects by ${g.label} that we map across Pune and the Mumbai Metropolitan Region, with locations, configurations, pricing and current status.`,
        related: locs(g.pins),
        relatedTitle: 'Localities where this developer is active',
      };
    case 'locality': {
      const devs = new Map<string, number>();
      for (const p of g.pins) if (p.developer) devs.set(p.developer, (devs.get(p.developer) || 0) + 1);
      return {
        title: `Real Estate Projects in ${g.label}`,
        lede: `Every project we map in ${g.label}: developers, status, configurations and pricing — and where each one sits on the live map.`,
        related: [...devs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, count]) => ({ label, kind: 'developer' as const, slug: slugify(label), count })),
        relatedTitle: `Developers active in ${g.label}`,
      };
    }
    case 'city':
      return {
        title: `Real Estate Projects in ${g.label}`,
        lede: `Projects across ${g.label}, organised by locality, developer and status — with a live, colour-coded map of where everything is.`,
        related: [
          ...statusGroups(all)
            .map((s) => ({ label: s.label, kind: 'status' as const, slug: s.slug, count: s.pins.filter((p) => cityOf(p) === g.slug).length }))
            .filter((s) => s.count > 0),
          ...localityGroups(all)
            .filter((l) => l.pins[0] && cityOf(l.pins[0]) === g.slug)
            .slice(0, 16)
            .map((l) => ({ label: l.label, kind: 'locality' as const, slug: l.slug, count: l.count })),
        ],
        relatedTitle: `Localities in ${g.label}`,
      };
    case 'status':
      return {
        title: `${g.label} Projects in Pune & MMR`,
        lede: `Projects that are ${g.label.toLowerCase()}, with developer, location, configuration and pricing.`,
        related: locs(g.pins),
        relatedTitle: 'By locality',
      };
    case 'type':
      return {
        title: `${g.label} Projects in Pune & MMR`,
        lede: `${g.label} projects we map, with developer, location, status and pricing.`,
        related: locs(g.pins),
        relatedTitle: 'By locality',
      };
  }
}

export default function BrowseScreen() {
  const { kind = '', slug = '' } = useLocalSearchParams<{ kind: string; slug: string }>();
  const router = useRouter();
  const { projects, isPending, isError, error, refetch } = useProjects();
  const logos = useDeveloperLogos();
  const group = useMemo(() => (isGroupKind(kind) ? findGroup(kind, slug, projects) : null), [kind, slug, projects]);

  if (isPending) return <LoadingState />;
  if (isError && !projects.length) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!group) {
    return <EmptyState title="Nothing here yet" text="There are no public projects for this page right now." action={{ title: 'Browse all projects', onPress: () => router.replace('/projects') }} />;
  }

  const copy = copyFor(group, projects);
  const localityCount = new Set(group.pins.map((p) => p.locality).filter(Boolean)).size;
  const logo = group.kind === 'developer' ? logos.get(group.slug) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: group.label }} />
      <FlatList
        data={group.pins}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProjectCard pin={item} />}
        contentContainerStyle={styles.list}
        initialNumToRender={6}
        windowSize={9}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {logo ? <Logo uri={logo} size={56} label={`${group.label} logo`} /> : null}
              <View style={styles.flex}>
                <AppText variant="eyebrow">{KIND_TITLES[group.kind]}</AppText>
                <AppText variant="title">{copy.title}</AppText>
              </View>
            </View>
            <AppText style={styles.lede}>{copy.lede}</AppText>
            <View style={styles.stats}>
              <Stat n={group.count} label={group.count === 1 ? 'Project' : 'Projects'} />
              {group.kind !== 'locality' ? <Stat n={localityCount} label={localityCount === 1 ? 'Locality' : 'Localities'} /> : null}
            </View>
            {copy.related.length ? (
              <>
                <AppText variant="heading" style={styles.relTitle}>
                  {copy.relatedTitle}
                </AppText>
                <View style={styles.pills}>
                  {copy.related.map((r) => (
                    <Pressable
                      key={`${r.kind}-${r.slug}`}
                      onPress={() => router.push({ pathname: '/browse/[kind]/[slug]', params: { kind: r.kind, slug: r.slug } })}
                      accessibilityRole="link"
                      accessibilityLabel={`${r.label}, ${r.count} projects`}
                      style={styles.pill}
                    >
                      <Text style={styles.pillText}>
                        {r.label} · {r.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <AppText variant="heading" style={styles.relTitle}>
              {group.kind === 'developer' ? `Projects by ${group.label}` : 'Projects'} ({group.count})
            </AppText>
          </View>
        }
      />
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  list: { padding: 16, paddingBottom: 32, backgroundColor: colors.paper },
  header: { marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lede: { marginTop: 8 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.land, borderWidth: 1, borderColor: colors.line },
  statN: { fontFamily: fonts.bold, fontSize: 20, color: colors.forest },
  statL: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  relTitle: { marginTop: 20, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.forestTint },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },
});
