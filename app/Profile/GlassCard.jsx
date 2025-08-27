// app/Profile/GlassCard.jsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function GlassCard({
  ctaLabel,
  helper,
  onPress,
  icon = "sliders",
  tone = "lilac",        // 'lilac' | 'cyan'
  disabled = false,
  style,
}) {
  const T = tone === "cyan" ? tones.cyan : tones.lilac;

  return (
    <View style={[s.card, style]}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.9}
        style={[s.cta, { borderColor: T.border }]}
        accessibilityRole="button"
      >
        {/* subtle sweep */}
        <View style={[s.sheen, { backgroundColor: T.sheen }]} />
        <View style={s.iconCapsule}>
          <Feather name={icon} size={16} color="#EAF0FF" />
        </View>
        <Text style={s.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>

      {!!helper && <Text style={s.helper}>{helper}</Text>}
    </View>
  );
}

const colors = {
  glass: "rgba(255,255,255,0.06)",
  stroke: "rgba(255,255,255,0.12)",
  text: "#EAF0FF",
  sub: "#9BA6C7",
};
const tones = {
  lilac: { sheen: "rgba(124,92,255,0.10)", border: "rgba(124,92,255,0.28)" },
  cyan:  { sheen: "rgba(55,226,255,0.10)", border: "rgba(55,226,255,0.28)"  },
};

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 6 },
    }),
  },
  cta: {
    position: "relative",
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sheen: {
    position: "absolute",
    width: "200%",
    height: "300%",
    borderRadius: 999,
    transform: [{ rotate: "18deg" }, { translateY: -120 }],
  },
  iconCapsule: {
    position: "absolute",
    left: 12,
    height: 34,
    width: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: 0.3 },
  helper: { marginTop: 10, fontSize: 13, color: colors.sub, textAlign: "center", lineHeight: 18 },
});
