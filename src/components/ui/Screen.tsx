import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { OfflineBanner } from '../OfflineBanner';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Safe-area edges to pad (screens under a header usually skip 'top'). */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  background?: string;
  footer?: ReactNode;
}

/** Standard screen: safe areas, keyboard avoidance, optional scroll + pull-to-refresh. */
export function Screen({ children, scroll = true, edges = ['bottom'], contentStyle, refreshing, onRefresh, background = colors.paper, footer }: Props) {
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }]}>
      <OfflineBanner />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.forest} colors={[colors.forest]} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
});
