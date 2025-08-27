import React, { useEffect, useRef } from "react";
import { SafeAreaView, View, Text, StyleSheet, Platform, TouchableOpacity, Animated, Easing } from "react-native";
import * as Animatable from "react-native-animatable";
import { Feather } from "@expo/vector-icons";

export default function Header({
  title = "My Profile",
  onLeftPress,
  onRightPress,
  leftIcon = "chevron-left",
  rightIcon = "settings",
}) {
  // shimmer sweep (opacity + translateX)
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
    ).start();
  }, [sweep]);
  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-110, 110] });

  // underline uses scaleX (native-driver friendly)
  const scale = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.0] });

  return (
    <SafeAreaView style={s.safe}>
      {/* Header container */}
      <Animatable.View animation="fadeInDown" duration={360} useNativeDriver>
        <View style={s.glass}>
          {/* subtle inner ring */}
          <View pointerEvents="none" style={s.innerRing} />

          {/* diagonal sheen */}
          <Animated.View
            pointerEvents="none"
            style={[s.sheen, { transform: [{ translateX }] }]}
          />

          {/* left */}
          <View style={s.side}>
            <TouchableOpacity
              onPress={onLeftPress}
              disabled={!onLeftPress}
              style={[s.iconBtn, !onLeftPress && { opacity: 0 }]}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              activeOpacity={0.7}
            >
              <Feather name={leftIcon} size={20} color="#EAF0FF" />
            </TouchableOpacity>
          </View>

          {/* center */}
          <View style={s.center}>
            <Text numberOfLines={1} style={s.title}>{title}</Text>
            <View style={s.underlineTrack}>
              <Animated.View style={[s.underlineFill, { transform: [{ scaleX: scale }] }]} />
            </View>
          </View>

          {/* right */}
          <View style={[s.side, { alignItems: "flex-end" }]}>
            <TouchableOpacity
              onPress={onRightPress}
              disabled={!onRightPress}
              style={[s.iconBtn, !onRightPress && { opacity: 0 }]}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              activeOpacity={0.7}
            >
              <Feather name={rightIcon} size={20} color="#EAF0FF" />
            </TouchableOpacity>
          </View>
        </View>
      </Animatable.View>
      <View style={s.bottomEdge} />
    </SafeAreaView>
  );
}

const C = {
  bg0: "#0B1022",
  glass: "rgba(255,255,255,0.06)",
  stroke: "rgba(255,255,255,0.12)",
  track: "rgba(255,255,255,0.16)",
  accent: "#7C5CFF",
  iconBg: "rgba(255,255,255,0.06)",
  iconStroke: "rgba(255,255,255,0.14)",
  text: "#F2F5FA",
};

const s = StyleSheet.create({
  safe: { backgroundColor: C.bg0 },
  glass: {
    height: 64,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.stroke,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 6 },
    }),
  },
  innerRing: { ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  sheen: {
    position: "absolute",
    left: "50%", top: -26, width: 140, height: 120, borderRadius: 24,
    transform: [{ rotate: "16deg" }],
    backgroundColor: "rgba(124,92,255,0.10)", borderWidth: 1, borderColor: "rgba(124,92,255,0.14)",
  },
  side: { width: 64, justifyContent: "center" },
  iconBtn: {
    height: 36, width: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.iconBg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.iconStroke,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: 0.2, color: C.text },
  underlineTrack: { height: 3, width: 110, borderRadius: 999, overflow: "hidden", backgroundColor: C.track },
  underlineFill: { height: 3, borderRadius: 999, backgroundColor: C.accent },
  bottomEdge: { height: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.06)" },
});
