import React from "react";
import PropTypes from "prop-types";
import { Pressable, View, Text, StyleSheet, Platform } from "react-native";

function GlassCard(props) {
  const {
    title = "",
    helper,
    ctaLabel,
    onPress,
    variant = "aurora", 
    leftIcon,
    style,
  } = props;

  const v = variantStyles[variant] || variantStyles.aurora;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        v.base,
        style,
        pressed && { transform: [{ translateY: 1 }] },
      ]}
    >
      <View style={s.glowWrap}>
        <View style={[s.glow, v.glow]} />
      </View>

      <View style={[s.outline, v.outline]} />

      {variant === "aurora" && (
        <View style={s.sheen} />
      )}

      {variant === "holo" && (
        <View pointerEvents="none" style={s.dotsWrap}>
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={i} style={[s.dot, { opacity: (i % 5) ? 0.18 : 0.28 }]} />
          ))}
        </View>
      )}

      <View style={s.row}>
        <View style={[s.iconWrap, v.iconWrap]}>
          {leftIcon ?? <Text style={s.iconTxt}>⚙️</Text>}
        </View>

        <View style={{ flex: 1 }}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          <Text style={s.cta}>{ctaLabel}</Text>
          {helper ? <Text style={s.helper}>{helper}</Text> : null}
        </View>

        {/* Trailing pill */}
        <View style={[s.pill, v.pill]}>
          <Text style={s.pillTxt}>›</Text>
        </View>
      </View>

      {variant === "holo" && (
        <View style={[s.cornerChip, v.cornerChip]}>
          <Text style={s.cornerChipTxt}>Labs</Text>
        </View>
      )}
    </Pressable>
  );
}

GlassCard.propTypes = {
  title: PropTypes.string,
  helper: PropTypes.string,
  ctaLabel: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["aurora", "holo"]),
  leftIcon: PropTypes.node,
  style: PropTypes.any,
};

export { GlassCard };
export default GlassCard;

const s = StyleSheet.create({
  base: {
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    backgroundColor: "rgba(14, 20, 39, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(200,210,255,0.08)",
  },
  row: { flexDirection: "row", alignItems: "center" },
  title: {
    color: "rgba(234,240,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cta: { color: "#EAF0FF", fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  helper: { color: "rgba(233,240,255,0.70)", fontSize: 13, lineHeight: 18, marginTop: 6 },

  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginRight: 12,
  },
  iconTxt: { fontSize: 18 },

  pill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, alignSelf: "flex-start", marginLeft: 12,
  },
  pillTxt: {
    color: "#EAF0FF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: Platform.OS === "ios" ? -2 : 0,
  },

  outline: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  glowWrap: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    overflow: "hidden",
    borderRadius: 20,
  },
  glow: {
    position: "absolute",
    width: 280, height: 280, borderRadius: 280,
    top: -120, right: -80, opacity: 0.35,
  },

  sheen: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
    transform: [{ skewY: "-8deg" }, { translateY: -20 }],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  dotsWrap: {
    position: "absolute",
    right: 14,
    top: 12,
    width: 120,
    height: 64,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dot: {
    width: 3, height: 3, borderRadius: 3, backgroundColor: "#CBE8FF",
    marginRight: 6, marginBottom: 6,
  },

  cornerChip: {
    position: "absolute",
    top: 10, right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  cornerChipTxt: { color: "#EAF0FF", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
});

const variantStyles = {
  aurora: StyleSheet.create({
    base: {
      backgroundColor: "rgba(26, 22, 52, 0.55)",
      borderColor: "rgba(124,92,255,0.25)",
    },
    outline: { borderColor: "rgba(124,92,255,0.22)" },
    glow: { backgroundColor: "rgba(124,92,255,0.45)" },
    iconWrap: {
      backgroundColor: "rgba(124,92,255,0.12)",
      borderColor: "rgba(124,92,255,0.35)",
    },
    pill: {
      borderColor: "rgba(124,92,255,0.45)",
      backgroundColor: "rgba(124,92,255,0.14)",
    },
  }),

  holo: StyleSheet.create({
    base: {
      backgroundColor: "rgba(10, 28, 38, 0.55)",
      borderColor: "rgba(49,196,190,0.22)",
    },
    outline: { borderColor: "rgba(49,196,190,0.25)" },
    glow: { backgroundColor: "rgba(49,196,190,0.42)" },
    iconWrap: {
      backgroundColor: "rgba(49,196,190,0.12)",
      borderColor: "rgba(49,196,190,0.35)",
    },
    pill: {
      borderColor: "rgba(49,196,190,0.45)",
      backgroundColor: "rgba(49,196,190,0.14)",
    },
    cornerChip: {
      borderColor: "rgba(49,196,190,0.45)",
      backgroundColor: "rgba(49,196,190,0.16)",
    },
  }),
};
