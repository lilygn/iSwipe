import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { backgroundColor: Colors[colorScheme ?? 'light'].background, borderTopWidth: 0, height: 60, paddingBottom: 8, paddingTop: 6 },
          default: { height: 60 },
        }),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="ExploreScreen"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="magnifyingglass.circle.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="Saved" 
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="heart.fill" color={color} />,
        }}
      />

      <Tabs.Screen
        name="Profile" 
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.crop.circle.fill" color={color} />,
        }}
      />

      <Tabs.Screen name="index" options={{ href: null , tabBarStyle: {display: 'none'}}} />
      <Tabs.Screen name="Interests" options={{ href: null }} />
      <Tabs.Screen name="ProfileWelcome" options={{ href: null }} />

      <Tabs.Screen name="Lab" options={{ href: null }} />
      
    </Tabs>
  );
}
