import React, { useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  Animated,
  SafeAreaView,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { SavedProfsContext } from "./savedProfContext";
import { SavedRSOsContext } from "./savedRSOsContext";

const PLACEHOLDER = "https://placehold.co/160x160/png?text=Prof";

const toHttpsAbs = (url, base) => {
  if (!url) return null;
  const u = String(url).trim();
  if (u.startsWith("//")) return `https:${u}`;
  try {
    if (u.startsWith("/")) return new URL(u, base).toString();
  } catch {}
  if (!/^https?:\/\//i.test(u)) return `https://${u}`;
  return u.replace(/^http:\/\//i, "https://");
};

const HeaderToggle = ({ mode, setMode }) => {
  return (
    <View style={styles.segmentWrap}>
      <TouchableOpacity
        onPress={() => setMode("profs")}
        style={[styles.segmentBtn, mode === "profs" && styles.segmentBtnActive]}
      >
        <Text style={[styles.segmentText, mode === "profs" && styles.segmentTextActive]}>
          Professors
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setMode("rsos")}
        style={[styles.segmentBtn, mode === "rsos" && styles.segmentBtnActive]}
      >
        <Text style={[styles.segmentText, mode === "rsos" && styles.segmentTextActive]}>
          RSOs
        </Text>
      </TouchableOpacity>
    </View>
  );
};

function SavedProfRow({ prof, onRemove, onOpen }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [uri, setUri] = useState(
    toHttpsAbs(prof.image || prof.img, prof.profileUrl) || PLACEHOLDER
  );

  const pop = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.05, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const handleOpen = () => {
    pop();
    onOpen?.(prof);
  };

  const handleRemove = () => {
    pop();
    onRemove?.(String(prof.id ?? prof.profileUrl ?? prof.name));
  };

  const subtitle = useMemo(() => {
    return (
      prof.title ||
      (Array.isArray(prof.areas) && prof.areas.join(", ")) ||
      (Array.isArray(prof.interests) && prof.interests.slice(0, 3).join(", ")) ||
      prof.email ||
      prof.office ||
      ""
    );
  }, [prof]);

  return (
    <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
      <Pressable onPress={handleOpen} style={styles.left} android_ripple={{ color: "#e9edf5" }}>
        <Image
          source={{ uri }}
          style={styles.avatar}
          onError={() => setUri(PLACEHOLDER)}
          resizeMode="cover"
        />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {prof.name || "Professor"}
          </Text>
          {!!subtitle && (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {!!prof.website && (
            <Text style={styles.link} numberOfLines={1}>
              {toHttpsAbs(prof.website, prof.profileUrl)}
            </Text>
          )}
        </View>
      </Pressable>

      <TouchableOpacity
        accessibilityLabel="Remove"
        onPress={handleRemove}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={styles.removeBtn}
      >
        <Feather name="x" size={18} color="#dc2626" />
      </TouchableOpacity>
    </Animated.View>
  );
}

function SavedRSORow({ rso, onRemove, onOpen }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pop = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.05, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  const handleOpen = () => {
    pop();
    onOpen?.(rso);
  };

  const handleRemove = () => {
    pop();
    onRemove?.(rso);
  };

  return (
    <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
      <Pressable onPress={handleOpen} style={[styles.left, { alignItems: "flex-start" }]} android_ripple={{ color: "#e9edf5" }}>
        <View style={[styles.avatar, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontWeight: "800" }}>RSO</Text>
        </View>
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {rso.name || "RSO"}
          </Text>
          {!!rso.description && (
            <Text style={styles.sub} numberOfLines={2}>
              {rso.description}
            </Text>
          )}
          {!!rso.url && (
            <Text style={styles.link} numberOfLines={1}>
              {toHttpsAbs(rso.url)}
            </Text>
          )}
        </View>
      </Pressable>

      <TouchableOpacity
        accessibilityLabel="Remove"
        onPress={handleRemove}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={styles.removeBtn}
      >
        <Feather name="x" size={18} color="#dc2626" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function SavedProfList({ items = [], onRemove, onClear, onOpen }) {
  const data = Array.isArray(items) ? items : [];
  const renderItem = ({ item }) => (
    <SavedProfRow prof={item} onRemove={onRemove} onOpen={onOpen} />
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(it, i) => String(it.id ?? it.profileUrl ?? it.name ?? i)}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>💾</Text>
          <Text style={styles.emptyTitle}>No saved professors yet</Text>
          <Text style={styles.emptySub}>
            Tap the heart on a professor to add them here.
          </Text>
        </View>
      }
    />
  );
}

export function SavedRSOList({ items = [], onRemove, onClear, onOpen }) {
  const data = Array.isArray(items) ? items : [];
  const renderItem = ({ item, index }) => (
    <SavedRSORow rso={item} onRemove={() => onRemove(item)} onOpen={onOpen} />
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(it, i) => String(it.name ?? i)}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📁</Text>
          <Text style={styles.emptyTitle}>No saved RSOs yet</Text>
          <Text style={styles.emptySub}>
            Save RSOs to see them here.
          </Text>
        </View>
      }
    />
  );
}

export default function SavedScreen() {
  const profCtx = useContext(SavedProfsContext) || {};
  const rsoCtx = useContext(SavedRSOsContext) || {};

  const { savedProfs = [], removeProf, clearProfs } = profCtx;
  const { savedRSOs = [], removeRSO, clearRSOs } = rsoCtx;

  const [mode, setMode] = useState("profs"); // "profs" | "rsos"

  const handleProfRemove = useCallback(
    (idOrProf) => {
      if (!removeProf) return;
      if (typeof idOrProf === "string") {
        const found = savedProfs.find(
          (p) => String(p.id ?? p.profileUrl ?? p.name) === idOrProf
        );
        removeProf(found ?? { id: idOrProf });
      } else {
        removeProf(idOrProf);
      }
    },
    [removeProf, savedProfs]
  );

  const handleRSORemove = useCallback(
    (rso) => {
      removeRSO?.(rso);
    },
    [removeRSO]
  );

  const count = mode === "profs" ? (savedProfs?.length || 0) : (savedRSOs?.length || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.page }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Saved</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          </View>

          <HeaderToggle mode={mode} setMode={setMode} />

          <TouchableOpacity
            onPress={mode === "profs" ? clearProfs : clearRSOs}
            disabled={(mode === "profs" ? savedProfs.length : savedRSOs.length) === 0}
            style={[
              styles.clear,
              (mode === "profs" ? savedProfs.length : savedRSOs.length) === 0 && { opacity: 0.45 },
            ]}
          >
            <Feather name="trash-2" size={16} color="#dc2626" />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {mode === "profs" ? (
          <SavedProfList
            items={savedProfs}
            onRemove={handleProfRemove}
            onClear={clearProfs}
            onOpen={(prof) => {
              if (prof.profileUrl) Linking.openURL(prof.profileUrl);
            }}
          />
        ) : (
          <SavedRSOList
            items={savedRSOs}
            onRemove={handleRSORemove}
            onClear={clearRSOs}
            onOpen={(rso) => {
              if (rso.url) Linking.openURL(toHttpsAbs(rso.url));
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  page: "#F6F7FB",
  card: "#FFFFFF",
  text: "#0F172A",
  sub: "#5B667A",
  link: "#2563EB",
  border: "#E9EEF5",
  redBg: "#FEECEC",
  redBorder: "#FECACA",
  segBg: "#0F172A0D",
  segActiveBg: "#FFFFFF",
  segBorder: "#E2E8F0",
  segShadow: "#000",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.page },

  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, letterSpacing: 0.2 },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E0E7FF",
  },
  countText: { color: "#4F46E5", fontWeight: "700", fontSize: 12 },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.segBg,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.segBorder,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.segActiveBg,
    shadowColor: COLORS.segShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  segmentText: { fontSize: 12, fontWeight: "700", color: COLORS.sub },
  segmentTextActive: { color: COLORS.text },

  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.redBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.redBorder,
  },
  clearText: { color: "#dc2626", fontWeight: "700", fontSize: 12, letterSpacing: 0.2 },

  item: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#E8ECF3",
    borderWidth: 1,
    borderColor: "#EDF2F7",
  },
  texts: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  sub: { marginTop: 3, fontSize: 13, color: COLORS.sub },
  link: { marginTop: 4, fontSize: 12, color: COLORS.link },

  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.redBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.redBorder,
  },

  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyEmoji: { fontSize: 26, marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.sub,
    textAlign: "center",
    lineHeight: 18,
  },
});
