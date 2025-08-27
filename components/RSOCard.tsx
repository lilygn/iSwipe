import React from 'react';
import { View, Text, Linking, TouchableOpacity, StyleSheet } from 'react-native';

export default function RSOCard({ name, description, website, instagram }) {
  const handlePress = (url) => {
    if (!url) {
      console.warn("No URL provided");
      return;
    }
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", err));
  };

  return (
    <View style={styles.card}>
      {/* Title box */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{name}</Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* Links */}
      {instagram  && (
        <TouchableOpacity style={styles.linkButton} onPress={() => handlePress(instagram)}>
          <Text style={styles.linkButtonText}>Visit Instagram</Text>
        </TouchableOpacity>
      )}

      {website && (
        <TouchableOpacity style={styles.linkButton} onPress={() => handlePress(website)}>
          <Text style={styles.linkButtonText}>Visit Website</Text>
        </TouchableOpacity>
      )}

  

    
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: 320,
    height: 400,
    alignSelf: 'center',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,

    justifyContent: 'space-between',
  },
  titleContainer: {
    backgroundColor: '#13294B', // UIUC navy
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF5F05', // UIUC orange
    textAlign: 'center',
  },
  descriptionContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#13294B', 
    textAlign: 'center',
  },
  linkButton: {
    backgroundColor: '#FF5F05', 
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  linkButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
});
