import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  password?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, optional, password, style, multiline, ref, ...rest }: Props) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} maxFontSizeMultiplier={1.4}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <View style={[styles.box, !!error && styles.boxError, multiline && styles.boxMulti]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          placeholderTextColor="#8a938f"
          secureTextEntry={password ? hidden : false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxFontSizeMultiplier={1.4}
          style={[styles.input, multiline && styles.inputMulti, style]}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.eye}
            hitSlop={8}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, marginBottom: 6 },
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: fieldStyles.label,
  optional: { fontFamily: fonts.regular, color: colors.muted },
  box: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  boxMulti: { alignItems: 'flex-start' },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  inputMulti: { minHeight: 110 },
  eye: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 5, color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
  hint: { marginTop: 5, color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
});
