import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { isDeveloper, useAuth } from '@/providers/AuthProvider';
import { getNotifications, markNotificationsRead } from '@/services/account';

/** A developer's review notifications (website: the dashboard's notification bell). */
export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { user, status } = useAuth();
  const enabled = status === 'signedIn' && isDeveloper(user);
  const q = useQuery({ queryKey: ['me', 'notifications'], queryFn: getNotifications, enabled });

  // Opening the list marks everything read (same as opening the bell).
  useEffect(() => {
    if (!q.data?.unread) return;
    markNotificationsRead()
      .then(() => qc.setQueryData(['me', 'notifications'], { ...q.data, unread: 0 }))
      .catch(() => undefined);
  }, [q.data, qc]);

  if (!enabled) return <EmptyState icon="notifications-outline" title="Notifications are for developer accounts" />;
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const tone = { pending: colors.road, approved: colors.success, rejected: colors.danger } as const;
  return (
    <FlatList
      data={q.data.items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      ListHeaderComponent={
        <Text style={styles.counts}>
          {q.data.counts.approved} approved · {q.data.counts.pending} pending · {q.data.counts.rejected} not approved
        </Text>
      }
      ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications yet" />}
      renderItem={({ item }) => (
        <View style={[styles.item, item.unread && styles.unread]}>
          <View style={[styles.dot, { backgroundColor: tone[item.state] }]} />
          <View style={styles.flex}>
            <Text style={styles.detail}>{item.detail}</Text>
            <Text style={styles.at}>{new Date(item.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  counts: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginBottom: 12 },
  item: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  unread: { borderColor: colors.forest, backgroundColor: colors.forestTint },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  flex: { flex: 1 },
  detail: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  at: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
