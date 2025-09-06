import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';
import axios from 'axios';
import { GenerateButton, ResetButton } from '../../components/Button';

const baseURL = process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://iswipe.onrender.com';

const api = axios.create({
  baseURL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export default function Interests() {
  const [input, setInput] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const addTag = () => {
    const t = input.trim().toLowerCase();
    if (!t) return;
    setTags(prev => [...prev, t]);
    setInput('');
  };

  const removeTag = (index) => {
    setTags(prev => prev.filter((_, i) => i !== index));
  };

  const clearInterests = () => {
    setTags([]);
    setInput('');
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (tags.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post('/generate-cards', { interests: tags });
      const filteredData = res.data || [];

      router.push({
        pathname: '/home',
        params: {
          filteredRSOs: JSON.stringify(filteredData),
          interests: JSON.stringify(tags),
        },
      });
    } catch (err) {
      console.error('Error generating cards:', err);
      alert('Failed to generate cards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 16 }}>
        What are you interested in?
      </Text>

      <TextInput
        style={{
          backgroundColor: '#f0f0f0',
          padding: 10,
          borderRadius: 8,
          fontSize: 16,
          marginBottom: 10,
        }}
        placeholder="e.g. robotics, music, health"
        value={input}
        onChangeText={setInput}
        onSubmitEditing={addTag}
        returnKeyType="done"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
        {tags.map((tag, i) => (
          <TouchableOpacity
            key={`${tag}-${i}`}
            onPress={() => removeTag(i)}
            style={{
              backgroundColor: '#6200ee',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              margin: 4,
            }}>
            <Text style={{ color: 'white' }}>#{tag} ✕</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading ? (
        <GenerateButton
          onPress={handleSubmit}
          title="Generate Cards"
          disabled={tags.length === 0}
        />
      ) : (
        <Animatable.View animation="fadeIn" style={{ marginTop: 20, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>
            Generating Cards...
          </Text>
        </Animatable.View>
      )}

      <ResetButton
        title="Clear Interests"
        onPress={clearInterests}
        style={{ marginTop: 20, alignSelf: 'center' }}
        disabled={loading}
      />
    </View>
  );
}
