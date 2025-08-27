import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';
import axios from 'axios';
import { Platform } from 'react-native';
import { GenerateButton, ResetButton } from '../../components/Button';

export default function Interests({ setInterests }) {
  const [input, setInput] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredRSOs, setFilteredRSOs] = useState([]);
  const navigation = useNavigation();
  const baseURL =
    Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://127.0.0.1:8000';

  const addTag = () => {
    if (input.trim() !== '') {
      const newTags = [...tags, input.trim().toLowerCase()];
      setTags(newTags);
      setInput('');
    }
  };

  const handleSubmit = () => {
    console.log('Hello');
    console.log('Tags:', tags);
    if (tags.length === 0) return;
    setLoading(true);
    console.log('Submitting interests:', tags);
    
    axios.post(`${baseURL}/generate-cards`, {interests: tags})
      .then(res => {
        console.log('Cards generated:', res.data);
        setLoading(false);
        setFilteredRSOs(res.data);
        navigateToHome(res.data);
      })
      .catch(error => {
        console.error('Error generating cards:', error);
        setLoading(false);
      });
  }
  
  const navigateToHome = (filtered) => {
  
    router.push({
      pathname: 'home',
      params: { filteredRSOs: JSON.stringify(filtered) }, 
    });
    setFilteredRSOs([]); // Clear filtered RSOs after navigation
    setTags([]); // Clear tags after generating cards
    setInput(''); // Reset input field

  };
   
  const clearInterests = () => {
    setTags([]);
    setInput('');
    setLoading(false);
    setFilteredRSOs([]);
    navigateToHome([]); 
  }

  const removeTag = (index) => {
    const newTags = tags.filter((_, i) => i !== index);
    setTags(newTags);
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
        }}
        placeholder="e.g. robotics, music, AI"
        value={input}
        onChangeText={setInput}
        onSubmitEditing={addTag}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        {tags.map((tag, i) => (
          <TouchableOpacity
            key={i}
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

        <GenerateButton onPress={handleSubmit} title= "Generate Cards" disabled={tags.length === 0}  > 
        </GenerateButton>
        
      
      ) : (
        <Animatable.View animation="fadeIn" style={{ marginTop: 40, alignItems: 'center' }} onPress={handleSubmit}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }} >
            Generating Cards...
          </Text>
        </Animatable.View>
  
      )}
       <ResetButton title= "Clear Interests" onPress={clearInterests}style={{ marginTop: 20, alignSelf: 'center' }} disabled={loading}> 
        Clear
        </ResetButton>

      
    </View>
  );
}
