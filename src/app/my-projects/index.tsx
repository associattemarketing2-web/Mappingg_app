import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { awaitingApproval, isDeveloper, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { getMyProjects, requestProjectDelete } from '@/services/account';
import { errorMessage } from '@/services/api/errors';
import type { DeveloperProject } from '@/types/models';

// A developer's own projects (website: developer dashboard → Projects). Every
// add or edit is held for review by the Mappingg team before it goes live, and
// deleting is only a request — the server enforces both.

const REVIEW: Record<DeveloperProject['review'], { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending review', bg: '#fff4e5', fg: '#9a5b00' },
  live: { label: 'Live on map', bg: '#e6f6ee', fg: '#0f7a4a' },
  rejected: { label: 'Not approved', bg: '#fdecec', fg: '#b42318' },
};
const STATUS_LABEL: Record<string, string> = { upcoming: 'Upcoming', under_construction: 'Under construction', construction: 'Under construction', available: 'Available', sold: 'Sold' };

export default function MyProjectsScreen() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user, status } = useAuth();
  const enabled = status === 'signedIn' && isDeveloper(user) && !awaitingApproval(user);
  const q = useQuery({ queryKey: ['me', 'projects'], queryFn: getMyProjects, enabled });
  const del = useMutation({
    mutationFn: requestProjectDelete,
    onSuccess: () => {
      toast('Delete request sent to the Mappingg team');
      void qc.invalidateQueries({ queryKey: ['me', 'projects'] });
      void qc.invalidateQueries({ queryKey: ['me', 'notifications'] });
    },
    onError: (e) => toast(errorMessage(e)),
  });

  if (!enabled) return <EmptyState icon="business-outline" title="For approved developer accounts" text="Your projects appear here once the Mappingg team has verified your account." />;
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const confirmDelete = (p: DeveloperProject) =>
    Alert.alert('Ask to delete this project?', `“${p.title}” stays as it is until the Mappingg team approves the deletion.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send request', style: 'destructive', onPress: () => del.mutate(p.id) },
    ]);

  const counts = { live: 0, pending: 0, rejected: 0 };
  for (const p of q.data) counts[p.review] += 1;

  return (
    <FlatList
      data={q.data}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      ListHeaderComponent={
        <View style={styles.header}>
          <AppText variant="caption">
            {counts.live} live · {counts.pending} pending · {counts.rejected} not approved
          </AppText>
          <Button title="Add a project" icon="add" onPress={() => router.push('/my-projects/edit')} style={styles.add} />
          <AppText variant="caption">Bulk upload from Excel / CSV is available in the website dashboard.</AppText>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="business-outline" title="No projects yet" text="Add your first project — it goes live on the map once approved." />}
      renderItem={({ item: p }) => {
        const r = REVIEW[p.review];
        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title} numberOfLines={2}>
                {p.number != null ? `#${p.number} · ` : ''}
                {p.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: r.bg }]}>
                <Text style={[styles.badgeText, { color: r.fg }]}>{r.label}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{[p.location, STATUS_LABEL[p.status] || p.status, p.type, p.configuration, p.price].filter(Boolean).join(' · ')}</Text>
            {p.review === 'rejected' && p.review_note ? <Text style={styles.note}>Reason: {p.review_note}. Edit it and send it again.</Text> : null}
            {p.delete_requested ? <Text style={styles.note}>Delete requested — waiting for the Mappingg team.</Text> : null}
            {!p.delete_requested && p.delete_note ? <Text style={styles.note}>Delete request declined: {p.delete_note}</Text> : null}
            <View style={styles.actions}>
              <Button title="Edit" compact variant="secondary" icon="create-outline" onPress={() => router.push({ pathname: '/my-projects/edit', params: { id: p.id } })} style={styles.flex} />
              {!p.delete_requested ? <Button title="Ask to delete" compact variant="danger" icon="trash-outline" onPress={() => confirmDelete(p)} style={styles.flex} loading={del.isPending && del.variables === p.id} /> : null}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 14, gap: 8 },
  add: { marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.earth },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flex: { flex: 1 },
});
