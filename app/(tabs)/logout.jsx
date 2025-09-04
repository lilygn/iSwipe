import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { router } from 'expo-router';  

export default function LogoutScreen() {
  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        Alert.alert('Signed out');
        router.replace('/');            
      })
      .catch(err => {
        console.error(err);
        Alert.alert('Error signing out', err.message);
      });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B111C' }}>
      <View style={styles.container}>
        <Text style={styles.title}>You are logged in</Text>
        <TouchableOpacity style={styles.btn} onPress={handleLogout}>
          <Text style={styles.btnText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#E6E9EE', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  btn: { backgroundColor: '#FF5F05', paddingVertical: 14, paddingHorizontal: 36, borderRadius: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
