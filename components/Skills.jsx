// Skills.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ViewStyle,
} from "react-native";

type Props = {
  skills: string[];
  setSkills: (skills: string[]) => void; 
  style?: ViewStyle;
  placeholder?: string;
};

export function Skills({ skills, setSkills, style, placeholder }: Props) {
  const [input, setInput] = useState("");

  const addIfValid = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (!skills.includes(v)) setSkills([...skills, v]);
    setInput("");
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tagsWrap}>
        {skills.map((skill, idx) => (
          <View key={`${skill}-${idx}`} style={styles.tag}>
            <Text style={styles.tagText}>{skill}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${skill}`}
              onPress={() => setSkills(skills.filter((s) => s !== skill))}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder={placeholder ?? "Type a skill and press Return"}
        placeholderTextColor="#94A3B8"
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={() => addIfValid(input)}
        blurOnSubmit={false}
      />
    </View>
  );
}

const COLORS = {
  border: "#E5E7EB",
  chipBg: "#EEF2FF",
  chipText: "#1F2937",
  removeBg: "#E0E7FF",
  removeText: "#374151",
  inputBg: "#F8FAFC",
  inputText: "#0F172A",
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tagText: {
    color: COLORS.chipText,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 6,
  },
  removeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.removeBg,
  },
  removeText: { color: COLORS.removeText, fontSize: 14, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.inputText,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
});
