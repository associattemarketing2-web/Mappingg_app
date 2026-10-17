import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';

export interface Option {
  value: string;
  label: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: readonly Option[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** A bottom sheet list of choices (used by selects and the country-code picker). */
export function OptionSheet({ visible, title, options, selected, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          initialNumToRender={20}
          renderItem={({ item }) => {
            const on = item.value === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Text style={[styles.itemText, on && styles.itemOn]}>{item.label}</Text>
                {on ? <Ionicons name="checkmark" size={20} color={colors.forest} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  item: {
    minHeight: TOUCH,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  itemPressed: { backgroundColor: colors.land },
  itemText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  itemOn: { fontFamily: fonts.semibold, color: colors.forest },
});
