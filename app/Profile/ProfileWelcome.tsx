import React from 'react';
import {
  Animated, Text, View, StyleSheet, Pressable, SafeAreaView, TextInput, Platform,
} from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

const baseURL =
  (process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://iswipe.onrender.com').replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  timeout: 8000, 
  headers: { 'Content-Type': 'application/json' },
});

async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseDelayMs = 600): Promise<T> {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, baseDelayMs * (1 << i)));
    }
  }
  throw lastErr;
}

async function backendReady(): Promise<boolean> {
  try {
    const res = await api.get('/healthz', { timeout: 5000 });
    return !!res?.data?.ok; 
  } catch {
    return false;
  }
}

export default function ProfileWelcome() {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [question, setQuestion] = React.useState('What are your research interests?');
  const [focused, setFocused] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const fadeIn = (animValue, duration = 300, toValue = 1, cb?) => {
    Animated.timing(animValue, { toValue, duration, useNativeDriver: true })
      .start(({ finished }) => finished && cb && cb());
  };
  const fadeOut = (animValue, duration = 250, toValue = 0, cb?) => {
    Animated.timing(animValue, { toValue, duration, useNativeDriver: true })
      .start(({ finished }) => finished && cb && cb());
  };

  const navigateToHome = (filtered) => {
    router.push({
      pathname: 'ExploreScreen',
      params: { filteredProfs: JSON.stringify(filtered ?? []) },
    });
    setInput('');
  };

  const handleSubmit = React.useCallback(async () => {
    const q = input.trim();
    if (!q || submitting) return;

    setSubmitting(true);
    try {
      const ready = await backendReady();
      if (!ready) {
        console.warn('Backend not ready; continuing with empty results.');
        navigateToHome([]);
        return;
      }

      const controller = new AbortController();
      const promise = () => api.post('/retrieve', { input: q }, { signal: controller.signal });

      const res = await withRetry(promise, 3);
      const docs = Array.isArray(res?.data) ? res.data : [];
      navigateToHome(docs);
    } catch (err) {
      console.error('retrieve failed:', err?.message || err);
      navigateToHome([]);
    } finally {
      setSubmitting(false);
      setInput('');
    }
  }, [input, submitting]);

  React.useEffect(() => {
    fadeIn(fadeAnim);
    return () => fadeOut(fadeAnim);
  }, [fadeAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <FontAwesome name="chevron-left" size={16} color={COLORS.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>Research Interests</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.heroWrap, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <View style={styles.innerRing} pointerEvents="none" />

          <Text style={styles.welcomeText}>{question}</Text>
          <Text style={styles.subText}>We’ll guide you step by step.</Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, focused && styles.inputFocused]}
              placeholder="e.g., human-computer interaction, robotics for healthcare, NLP education"
              placeholderTextColor={COLORS.placeholder}
              value={input}
              onChangeText={setInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
            />
            <View style={styles.inputSheen} pointerEvents="none" />
          </View>

          <Pressable
            disabled={submitting || !input.trim()}
            style={({ pressed }) => [
              styles.button,
              (pressed || submitting) && styles.buttonPressed,
              (!input.trim() || submitting) && { opacity: 0.6 },
            ]}
            onPress={() => {
              fadeOut(fadeAnim, 220, 0, () => {
                setQuestion('Any additional information?');
                fadeAnim.setValue(0);
                fadeIn(fadeAnim, 220, 1);
              });
              handleSubmit();
            }}
            accessibilityRole="button"
            accessibilityLabel="Submit interests"
          >
            <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Submit'}</Text>
          </Pressable>

          <Pressable
            disabled={submitting}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>Back</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const COLORS = {
  page: '#0B0F14',
  glass: 'rgba(255,255,255,0.08)',
  surface: 'rgba(255,255,255,0.10)',
  surfaceAlt: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.16)',
  ring: 'rgba(255,255,255,0.18)',
  divider: 'rgba(255,255,255,0.08)',
  text: '#F1F5F9',
  sub: '#B7C0CE',
  muted: '#9CA3AF',
  placeholder: '#9BA3B0',
  primaryStrong: '#4B5563',
  primary: '#6B7280',
};

const SHADOWS = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 10 },
  }),
  soft: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 6 },
  }),
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.page },
  topBar: {
    height: 56, marginHorizontal: 12, marginTop: 6, borderRadius: 14, paddingHorizontal: 10,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...SHADOWS.soft,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  backBtnPressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  topTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  heroWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    width: '90%', maxWidth: 560, alignItems: 'center', paddingVertical: 26, paddingHorizontal: 22,
    borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOWS.card, overflow: 'hidden',
  },
  innerRing: { ...StyleSheet.absoluteFillObject, borderRadius: 20, borderWidth: 1, borderColor: COLORS.ring },
  welcomeText: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: COLORS.text, textAlign: 'center', letterSpacing: 0.2 },
  subText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: COLORS.sub, textAlign: 'center' },
  inputWrap: { width: '100%', marginTop: 18, position: 'relative' },
  input: {
    width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.text, textAlign: 'center', includeFontPadding: false,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    ...Platform.select({ ios: { shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }, android: { elevation: 8 } }),
  },
  inputSheen: {
    position: 'absolute', right: -40, top: -30, width: 160, height: 120, borderRadius: 24,
    transform: [{ rotate: '-18deg' }], backgroundColor: 'rgba(124,92,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(124,92,255,0.14)',
  },
  button: {
    marginTop: 14, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryStrong, ...SHADOWS.soft,
  },
  buttonPressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  linkBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 8 },
  linkText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
});
