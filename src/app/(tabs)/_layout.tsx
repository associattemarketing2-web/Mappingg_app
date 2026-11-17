import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { usePins } from '@/hooks/usePublicData';
import { loadLogos, pinLogoUrls } from '@/services/logoCache';
import { hasCoords } from '@/services/publicData';

type IconName = keyof typeof Ionicons.glyphMap;

/** Bottom-bar icon: outline when idle, filled on a soft green pill when active. */
function icon(on: IconName, off: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean; size: number }) {
    return (
      <View style={[styles.pill, focused && styles.pillOn]}>
        <Ionicons name={focused ? on : off} size={23} color={typeof color === 'string' ? color : colors.muted} />
      </View>
    );
  };
}

/** Starts saving the map's pin logos soon after launch, so the live map opens
 *  with them already on the phone instead of filling them in one by one. */
function PinLogoWarmup() {
  const { data } = usePins();
  useEffect(() => {
    if (Platform.OS === 'web' || !data?.length) return;
    const t = setTimeout(() => void loadLogos(pinLogoUrls(data.filter(hasCoords), 73.914, 18.5215)), 1200);
    return () => clearTimeout(t);
  }, [data]);
  return null;
}

export default function TabsLayout() {
  return (
    <>
    <PinLogoWarmup />
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 2 },
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        headerStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="map" options={{ title: 'Map', headerShown: false, tabBarIcon: icon('map', 'map-outline'), tabBarAccessibilityLabel: 'Live map' }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: icon('business', 'business-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen
        name="account"
        options={{ title: 'More', headerTitle: 'Profile & more', tabBarIcon: icon('ellipsis-horizontal', 'ellipsis-horizontal'), tabBarAccessibilityLabel: 'Profile, settings and more' }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    borderTopColor: colors.line,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  item: { paddingVertical: 2 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.forestTint },
});
