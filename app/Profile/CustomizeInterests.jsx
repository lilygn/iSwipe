import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { GlassCard } from "./GlassCard";
import Header from "./ProfileHeader";
import { router } from "expo-router";

export default function SelectInterests() {
  return (
    <View style={s.wrap}>
      <Header title="My Profile" onLeftPress={() => router.back()} onRightPress={() => router.push("/Profile/Settings")} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionTitle}>Customize Your Interests</Text>
        <View style={s.sectionUnderline} />
        <GlassCard
          title=""
          ctaLabel="Customize Interests"
          helper="Pick topics you care about so we can surface the most relevant RSOs and professors."
          onPress={() => router.push("/Profile/Interests")}
        />
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Customize Your Research Interests</Text>
        <View style={[s.sectionUnderline, { width: 220 }]} />
        <GlassCard
          title=""
          ctaLabel="Customize Lab Interests"
          helper="Pick topics you care about so we can surface the most relevant professors."
          onPress={() => router.push("/Profile/ProfileWelcome")}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0B1022" },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  sectionTitle: { color: "#EAF0FF", fontSize: 22, fontWeight: "800", letterSpacing: 0.2 },
  sectionUnderline: { height: 2, width: 160, backgroundColor: "rgba(124,92,255,0.35)", borderRadius: 2, marginTop: 6, marginBottom: 8 },
});
