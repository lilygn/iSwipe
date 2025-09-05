import React, { useMemo, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import RSOCard from '@/components/RSOCard';
const rsoData = require('../assets/all_rso_data.json');
import { useLocalSearchParams } from 'expo-router';
import { SavedRSOsContext } from './savedRSOsContext';

type RSO = {
  name: string;
  description: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  link?: string;
};

const toHttps = (u?: string): string | undefined => {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s.replace(/^http:\/\//i, 'https://');
  return `https://${s}`;
};

const canonKey = (r: Partial<RSO>): string => {
  const byUrl = (r.link || r.website || '').trim().toLowerCase();
  if (byUrl) return byUrl;
  return (r.name || '').trim().toLowerCase();
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function RSOSwiper() {
  const { filteredRSOs } = useLocalSearchParams();
  const { addRSO } = useContext(SavedRSOsContext);
  const swiperRef = useRef<any>(null);

  const parsedIncoming: RSO[] = useMemo(() => {
    try {
      if (Array.isArray(filteredRSOs)) {
        return filteredRSOs.flatMap((s) => {
          try { return JSON.parse(String(s)) as RSO[]; } catch { return []; }
        });
      }
      if (typeof filteredRSOs === 'string') {
        const val = filteredRSOs.trim();
        return val ? (JSON.parse(val) as RSO[]) : [];
      }
      return [];
    } catch {
      return [];
    }
  }, [filteredRSOs]);

  const mappedAll: RSO[] = useMemo(
    () =>
      (Array.isArray(rsoData) ? rsoData : []).map((rso: any): RSO => ({
        name: rso.name || rso.title || 'Unknown RSO',
        description: rso.description || '',
        website: toHttps(rso.link),
        instagram: rso.instagram?.trim() ? toHttps(rso.instagram) : undefined,
        facebook: rso.facebook?.trim() ? toHttps(rso.facebook) : undefined,
        link: rso.link,
      })),
    []
  );

  const mappedIncoming: RSO[] = useMemo(
    () =>
      parsedIncoming.map((rso: any): RSO => ({
        name: rso.name || rso.title || 'Unknown RSO',
        description: rso.description || '',
        website: toHttps(rso.website || rso.link),
        instagram: rso.instagram?.trim() ? toHttps(rso.instagram) : undefined,
        facebook: rso.facebook?.trim() ? toHttps(rso.facebook) : undefined,
        link: rso.link,
      })),
    [parsedIncoming]
  );

  // Build sets for matching & de-dup
  const allowSet = useMemo(() => new Set(mappedIncoming.map(canonKey)), [mappedIncoming]);
  const allSet = useMemo(() => new Set(mappedAll.map(canonKey)), [mappedAll]);

  // If we have incoming filters: keep only matches from local data; also add any extra incoming not in local file
  const filteredFromAll = useMemo(() => {
    if (allowSet.size === 0) return mappedAll;
    return mappedAll.filter((r) => allowSet.has(canonKey(r)));
  }, [mappedAll, allowSet]);

  const extrasFromIncoming = useMemo(() => {
    if (allowSet.size === 0) return [];
    return mappedIncoming.filter((r) => !allSet.has(canonKey(r)));
  }, [mappedIncoming, allSet, allowSet]);

  const cards: RSO[] = useMemo(() => {
    const base = allowSet.size > 0 ? [...filteredFromAll, ...extrasFromIncoming] : mappedAll;
    // Optional: stable de-dup just in case
    const seen = new Set<string>();
    const uniq: RSO[] = [];
    for (const r of base) {
      const k = canonKey(r);
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(r);
      }
    }
    return uniq;
  }, [allowSet, filteredFromAll, extrasFromIncoming, mappedAll]);

  const [seed, setSeed] = useState(0);
  const [deck, setDeck] = useState(() => shuffle(cards));

  useEffect(() => {
    setDeck(shuffle(cards));
    setSeed((s) => s + 1);
  }, [cards]);

  const onSwipedRight = useCallback(
    (i: number) => {
      const c = deck[i];
      if (c) addRSO(c);
    },
    [deck, addRSO]
  );

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        key={`deck-${seed}`}
        cards={deck}
        renderCard={(card: RSO) =>
          card ? (
            <RSOCard
              name={card.name}
              description={card.description}
              website={card.website}
              instagram={card.instagram}
            />
          ) : null
        }
        stackSize={3}
        backgroundColor="transparent"
        cardIndex={0}
        onSwipedRight={onSwipedRight}
        verticalSwipe={false}
        overlayLabels={{
          left: { title: 'NOPE', style: { label: styles.nope } },
          right: { title: 'JOIN', style: { label: styles.join } },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 60, paddingHorizontal: 20 },
  nope: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.28)',
    borderWidth: 1,
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  join: {
    backgroundColor: 'rgba(22,163,74,0.14)',
    borderColor: 'rgba(22,163,74,0.28)',
    borderWidth: 1,
    color: '#16A34A',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
