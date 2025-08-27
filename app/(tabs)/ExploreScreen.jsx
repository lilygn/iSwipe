import React, { useCallback, useMemo, useRef, useState, useEffect, useContext } from "react";
import {
  Animated,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import FontAwesome from "react-native-vector-icons/FontAwesome5";
import { useRoute, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from "expo-router";
import { SavedProfsContext } from "./savedProfContext";

const json_file = require("../../professors.json");
const fac = json_file.faculty;

const PLACEHOLDER = "https://placehold.co/160x160/png?text=Prof";
const normalizeId = (x) => String(x?.id ?? x?.profileUrl ?? x?.link ?? x?.name ?? "");
const canon = (u) => {
  if (!u) return "";
  const s = String(u).trim();
  if (s.startsWith("//")) return `https:${s}`.toLowerCase();
  if (!/^https?:\/\//i.test(s)) return `https://${s}`.toLowerCase();
  return s.replace(/^http:\/\//i, "https://").toLowerCase();
};
const profKey = (p) => canon(p?.profileUrl) || (p?.name ? String(p.name).trim().toLowerCase() : "");
const ALLOW_SET = new Set(fac.map((f) => profKey(f)).filter(Boolean));

function HeartButton({ saved, onToggle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    onToggle?.();
  };
  return (
    <TouchableOpacity onPress={handlePress} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
      <Animated.View style={[styles.heart, { transform: [{ scale }] }]}>
        <FontAwesome name="heart" size={18} solid={saved} color={saved ? "#ea266d" : "#9AA0A6"} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function ProfessorCard({ item, saved, onToggleSave, onPressCard, onSelectTag }) {
  const [avatarUri, setAvatarUri] = useState(item.image || item.img || PLACEHOLDER);
  const imgOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setAvatarUri(item.image || item.img || PLACEHOLDER);
  }, [item.image, item.img]);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPressCard} style={styles.card}>
      <View style={styles.heartWrap}>
        <HeartButton saved={saved} onToggle={onToggleSave} />
      </View>
      <View style={styles.topRow}>
        <Animated.Image
          source={{ uri: avatarUri }}
          onError={() => setAvatarUri(PLACEHOLDER)}
          onLoad={() =>
            Animated.timing(imgOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start()
          }
          style={[styles.avatar, { opacity: imgOpacity }]}
        />
        <View style={styles.titleBlock}>
          <Pressable
            accessibilityRole="link"
            onPress={(e) => {
              e.stopPropagation();
              if (item.profileUrl) Linking.openURL(item.profileUrl);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.name} numberOfLines={1}>{item.name || "Professor Name"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={(e) => {
              e.stopPropagation();
              if (item.website) Linking.openURL(item.website);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.lab} numberOfLines={1}>{item.website || ""}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.summary} numberOfLines={3}>
        {item.summary ||
          "Short summary of the professor’s research focus, projects, and interests. This text truncates after a few lines to stay tidy."}
      </Text>
      {!!(item.interests?.length) && (
        <View style={styles.chipsRow}>
          {item.interests.slice(0, 4).map((c, i) => (
            <View key={`${c}-${i}`} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1} onPress={() => onSelectTag?.(c)}>
                #{c}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [DATA, setDATA] = useState([]);
  const { savedProfs, addProf, removeProf } = useContext(SavedProfsContext);
  const savedIdSet = useMemo(
    () => new Set(savedProfs.map((p) => normalizeId(p))),
    [savedProfs]
  );
  useEffect(() => {
    const newData = fac.map((f, i) => ({
      name: f.nameOnProfile || f.name,
      profileUrl: f.profileUrl,
      image: f.image ? (f.image.startsWith("//") ? "https:" + f.image : f.image) : PLACEHOLDER,
      lab: f.lab || "Lab website",
      labUrl: f.labUrl || "",
      website: f.website || "",
      summary:
        f.email ||
        "Short summary of the professor’s research focus, projects, and interests. This text truncates after a few lines to stay tidy.",
      interests: f.interests || f.areas || ["No", "in"],
      id: String(f.id ?? i + 1),
    }));
    setDATA(newData);
  }, []);
  const filtered = useMemo(() => {
    const base = DATA.filter((d) => ALLOW_SET.has(profKey(d)));
    if (!query) return base;
    const q = query.toLowerCase();
    return base.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.lab?.toLowerCase().includes(q) ||
        d.interests?.some((t) => String(t).toLowerCase().includes(q))
    );
  }, [query, DATA]);
  const navigation = useNavigation();
  const route = useRoute();
  const filteredProfsParam = useLocalSearchParams().filteredProfs;
  const toHttpsAbs = (url, base) => {
    if (!url) return null;
    const u = String(url).trim();
    if (u.startsWith("//")) return `https:${u}`;
    if (u.startsWith("/")) {
      try {
        return new URL(u, base).toString();
      } catch {
        return null;
      }
    }
    if (!/^https?:\/\//i.test(u)) return `https://${u}`;
    return u.replace(/^http:\/\//i, "https://");
  };
  const parsedProfs = useMemo(() => {
    try {
      let arr = [];
      if (Array.isArray(filteredProfsParam)) {
        arr = filteredProfsParam.flatMap((s) => {
          try {
            return JSON.parse(s);
          } catch {
            return [];
          }
        });
      } else if (typeof filteredProfsParam === "string") {
        const val = filteredProfsParam.trim();
        arr = val ? JSON.parse(val) : [];
      }
      const mapped = arr.map((p, i) => ({
        ...p,
        id: normalizeId({ ...p, id: p.id ?? i + 1 }),
        image: toHttpsAbs(p.image || p.img, p.profileUrl) || PLACEHOLDER,
        website: toHttpsAbs(p.website, p.profileUrl) || "",
        labUrl: toHttpsAbs(p.labUrl, p.profileUrl) || "",
        profileUrl: toHttpsAbs(p.profileUrl, p.website) || "",
        summary: p.email || "No summary provided.",
        name: p.name || p.nameOnProfile || "",
      }));
      return mapped.filter((p) => ALLOW_SET.has(profKey(p)));
    } catch {
      return [];
    }
  }, [filteredProfsParam]);
  const data = parsedProfs.length > 0 ? parsedProfs : filtered;
  const removeById = useCallback(
    (id) => {
      const existing = savedProfs.find((p) => normalizeId(p) === id);
      if (existing) removeProf(existing);
    },
    [savedProfs, removeProf]
  );
  const toggleSave = useCallback(
    (item) => {
      const id = normalizeId(item);
      if (savedIdSet.has(id)) {
        removeById(id);
      } else {
        addProf({ ...item, id });
      }
    },
    [savedIdSet, addProf, removeById]
  );
  const onSelectTag = useCallback((tag) => setQuery(tag), []);
  const renderItem = ({ item }) => {
    const saved = savedIdSet.has(normalizeId(item));
    return (
      <ProfessorCard
        item={item}
        saved={saved}
        onToggleSave={() => toggleSave(item)}
        onPressCard={() => {}}
        onSelectTag={onSelectTag}
      />
    );
  };
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <View style={styles.search}>
          <Feather name="search" size={18} color="#64748B" style={{ marginRight: 6 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search professors, labs, interests"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="sliders" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={data}
        keyExtractor={(it) => normalizeId(it)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const COLORS = {
  page: "#F5F7FA",
  card: "#FFFFFF",
  text: "#0F172A",
  sub: "#64748B",
  link: "#2563EB",
  border: "#E5E7EB",
  chipBg: "#F1F5FF",
  chipBorder: "#DDE3FF",
  chipText: "#4F46E5",
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.page },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heartWrap: { position: "absolute", right: 10, top: 10 },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFFF2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 40 },
  avatar: { width: 60, height: 60, borderRadius: 14, backgroundColor: "#E5E7EB" },
  titleBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.link },
  lab: { marginTop: 2, fontSize: 14, color: COLORS.link, opacity: 0.95 },
  summary: { marginTop: 8, fontSize: 14, lineHeight: 21, color: COLORS.sub },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.chipBorder,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.chipText, letterSpacing: 0.2 },
});
