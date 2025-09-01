import React from "react";
import {
  Pressable,
  Text,
  ViewStyle,
  StyleSheet,
  ActivityIndicator,
  Platform,
  View,
} from "react-native";

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function GenerateButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.2)" }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        pressed && styles.pressedPrimary,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ResetButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(99,102,241,0.12)" }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles.ghost,
        pressed && styles.pressedGhost,
        isDisabled && styles.disabledGhost,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading && <ActivityIndicator size="small" color="#4F46E5" />}
        <Text style={[styles.ghostText, loading && { marginLeft: 8 }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const COLORS = {
  primary: "#5B5BD6", 
  primaryText: "#FFFFFF",
  ghostText: "#1F2937",
  stroke: "#E5E7EB",
  ghostBg: "#F8FAFC",
};

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: Platform.OS === "android" ? 2 : 0,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  primaryText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pressedPrimary: {
    transform: [{ scale: 0.995 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.6,
  },
  ghost: {
    backgroundColor: COLORS.ghostBg,
    borderWidth: 1,
    borderColor: COLORS.stroke,
  },
  ghostText: {
    color: COLORS.ghostText,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  pressedGhost: {
    backgroundColor: "#EFF6FF",
    transform: [{ scale: 0.995 }],
  },
  disabledGhost: {
    opacity: 0.65,
  },
  row: { flexDirection: "row", alignItems: "center" },
});
