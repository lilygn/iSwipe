import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';

export function Header() {
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        RSO Swiper
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#13294B', // UIUC Navy Blue
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  headerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF5F05', // UIUC Orange
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
