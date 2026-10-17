import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { errorMessage, isApiError } from '@/services/api/errors';
import { AppText } from './AppText';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.forest} />
      <AppText variant="caption" style={styles.gap}>
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = isApiError(error, 'network');
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={40} color={colors.muted} />
      <AppText variant="heading" style={styles.gap}>
        {title || (offline ? 'You’re offline' : 'Couldn’t load this')}
      </AppText>
      <AppText variant="body" style={styles.text}>
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button title="Try again" icon="refresh" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'search-outline',
  title,
  text,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <AppText variant="heading" style={styles.gap}>
        {title}
      </AppText>
      {text ? (
        <AppText variant="body" style={styles.text}>
          {text}
        </AppText>
      ) : null}
      {action ? <Button title={action.title} onPress={action.onPress} variant="secondary" style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gap: { marginTop: 12, textAlign: 'center' },
  text: { marginTop: 6, textAlign: 'center', maxWidth: 340 },
  button: { marginTop: 18, minWidth: 160 },
});
