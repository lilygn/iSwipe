import React, { useMemo, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import RSOCard from '@/components/RSOCard';
const rsoData = require('../assets/all_rso_data.json');
import { useNavigation, useRoute } from '@react-navigation/native';
import { SavedRSOsContext } from './savedRSOsContext';
import { useLocalSearchParams } from 'expo-router';

export default function RSOSwiper() {
  type RSO = {
    name: string;
    description: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    link?: string;
  };

  const navigation = useNavigation();
  const route = useRoute();
  const filteredRSOs = useLocalSearchParams().filteredRSOs;
  const { addRSO } = useContext(SavedRSOsContext);
  const swiperRef = useRef<any>(null);

  const parsedInterests: any[] = useMemo(() => {
    try {
      if (Array.isArray(filteredRSOs)) {
        return filteredRSOs.flatMap(s => {
          try { return JSON.parse(s as string); } catch { return []; }
        });
      }
      if (typeof filteredRSOs === 'string') {
        const val = filteredRSOs.trim();
        return val ? JSON.parse(val) : [];
      }
      return [];
    } catch {
      return [];
    }
  }, [filteredRSOs]);

  const onSwipedRight = (card: RSO) => {
    addRSO(card);
  };

  const mappedRSOs: RSO[] = useMemo(() => rsoData.map((rso: any) => ({
    ...rso,
    website: rso.link || undefined,
    instagram: rso.instagram?.trim() ? rso.instagram : undefined,
    facebook: rso.facebook?.trim() ? rso.facebook : undefined,
  })), []);

  const mappedInterests: RSO[] = useMemo(() => parsedInterests.map((rso: any) => ({
    ...rso,
    website: rso.link,
    instagram: rso.instagram !== "" ? rso.instagram : "Not Available",
  })), [parsedInterests]);

  const cards = parsedInterests.length !== 0 ? mappedInterests : mappedRSOs;

  const shuffleArray = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const [deck, setDeck] = useState<RSO[]>(() => shuffleArray(cards));
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setDeck(shuffleArray(cards));
    setSeed(s => s + 1);
  }, [cards]);



  const deckKey = useMemo(() => `deck-${seed}`, [seed]);

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        key={deckKey}
        cards={deck}
        renderCard={(card: RSO) => (
          <RSOCard
            name={card.name}
            description={card.description}
            website={card.website}
            instagram={card.instagram}
          />
        )}
        stackSize={3}
        backgroundColor="transparent"
        cardIndex={0}
        onSwiped={() => {}}
        onSwipedAll={() => {}}
        onTapCard={() => {}}
        onSwipedRight={(i) => {
          const c = deck[i];
          if (c) onSwipedRight(c);
        }}
        verticalSwipe={false}
        overlayLabels={{
          left: { title: 'NOPE', style: { label: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.28)', borderWidth: 1, color: '#EF4444', fontSize: 18, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 } } },
          right:{ title: 'JOIN', style: { label: { backgroundColor: 'rgba(22,163,74,0.14)', borderColor: 'rgba(22,163,74,0.28)', borderWidth: 1, color: '#16A34A', fontSize: 18, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 } } },
        }}
      />

      
    </View>
  );
}

const ORANGE = '#FF5F05';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 60,
    paddingHorizontal: 20,
  },
});
