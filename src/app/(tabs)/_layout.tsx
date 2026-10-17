import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { colors, fonts } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
function icon(on: IconName, off: IconName) {
  return function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? on : off} size={size} color={typeof color === 'string' ? color : colors.muted} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        headerStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Map', headerShown: false, tabBarIcon: icon('map', 'map-outline'), tabBarAccessibilityLabel: 'Live map' }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: icon('business', 'business-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
