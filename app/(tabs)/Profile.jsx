// app/profile.jsx (or .tsx)
import React from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import Header from "../Profile/ProfileHeader";
import GlassCard from "../Profile/GlassCard";
import { router } from "expo-router";

export default function Profile() {
  return (
    <SafeAreaView style={s.safe}>
      <Header
        title="My Profile"
        onLeftPress={() => router.back()}
        onRightPress={() => router.push("/Profile/Settings")}
      />

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <Text style={s.sectionTitle}>Customize Your Interests</Text>
        <View style={s.underline} />

        <GlassCard
          ctaLabel="Customize Interests"
          helper="Pick topics you care about so we can surface the most relevant RSOs and professors."
          onPress={() => router.push("/Profile/Interests")}
          tone="lilac"
        />

        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Customize Your Research Interests</Text>
        <View style={[s.underline, { width: 220 }]} />

        <GlassCard
          ctaLabel="Customize Lab Interests"
          helper="Pick topics you care about so we can surface the most relevant professors."
          onPress={() => router.push("/Profile/ProfileWelcome")}
          tone="cyan"
          style={{ marginBottom: 8 }}
        />

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1022" },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { color: "#EAF0FF", fontSize: 22, fontWeight: "800", letterSpacing: 0.2 },
  underline: { height: 2, width: 170, marginTop: 6, marginBottom: 8, backgroundColor: "rgba(124,92,255,0.35)", borderRadius: 2 },
});
