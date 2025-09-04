import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const navigation = useNavigation();

  // --- helpers ---
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const MIN_PW = 6;

  const handleLogin = () => {
    const e = email.trim();                
    const p = password;

    if (!isValidEmail(e)) {
      Alert.alert('Invalid email', 'Please enter a valid email like you@illinois.edu');
      return;
    }
    if (p.length < MIN_PW) {
      Alert.alert('Weak password', `Password must be at least ${MIN_PW} characters.`);
      return;
    }

    signInWithEmailAndPassword(auth, e, p)
      .then(userCredential => {
        const user = userCredential.user;
        console.log('Logged in as:', user.email);
        Alert.alert('Login successful!');
        navigation.replace('(tabs)');       
      })
      .catch(err => {
        const map: Record<string, string> = {
          'auth/invalid-email': 'That email looks malformed.',
          'auth/user-not-found': 'No account with that email.',
          'auth/wrong-password': 'Incorrect password.',
          'auth/too-many-requests': 'Too many attempts. Try again later.',
        };
        Alert.alert('Login failed', map[err.code] ?? err.message);
        console.error('Login error:', err.code, err.message, { email: e });
      });
  };

  const handleSignUp = () => {
    const e = email.trim();                
    const p = password;

    if (!isValidEmail(e)) {
      Alert.alert('Invalid email', 'Please enter a valid email like you@illinois.edu');
      return;
    }
    if (p.length < MIN_PW) {
      Alert.alert('Weak password', `Password must be at least ${MIN_PW} characters.`);
      return;
    }

    createUserWithEmailAndPassword(auth, e, p)
      .then(userCredential => {
        const user = userCredential.user;
        console.log('Registered as:', user.email);
        Alert.alert('Account created successfully!');
      
      })
      .catch(err => {
        const map: Record<string, string> = {
          'auth/email-already-in-use': 'That email is already registered.',
          'auth/invalid-email': 'That email looks malformed.',
          'auth/operation-not-allowed': 'Email/password sign-in is disabled in Firebase Console.',
          'auth/weak-password': 'Password is too weak.',
        };
        Alert.alert('Signup failed', map[err.code] ?? err.message);
        console.error('Signup error:', err.code, err.message, { email: e });
      });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is logged in:', user.email);
        navigation.replace('home');         
      }
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Background */}
        <View style={styles.bg}>
          <View style={[styles.gradientLayer, styles.layerTop]} />
          <View style={[styles.gradientLayer, styles.layerBottom]} />
        </View>

        {/* Content */}
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>Welcome back. Enter your details to continue.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => setEmail(t.replace(/\s/g, ''))} 
                placeholder="you@illinois.edu"
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus(null)}
                placeholderTextColor="#8A93A4"
                style={[styles.input, focus === 'email' && styles.inputFocused]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                onFocus={() => setFocus('password')}
                onBlur={() => setFocus(null)}
                placeholderTextColor="#8A93A4"
                style={[styles.input, focus === 'password' && styles.inputFocused]}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} activeOpacity={0.92}>
              <Text style={styles.primaryText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignUp} activeOpacity={0.92}>
              <Text style={styles.secondaryText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footnote}>© {new Date().getFullYear()} Swipe</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#0B111C',
  glass: 'rgba(255,255,255,0.08)',
  glassStroke: 'rgba(255,255,255,0.18)',
  input: 'rgba(255,255,255,0.06)',
  inputStroke: 'rgba(255,255,255,0.14)',
  white: '#FFFFFF',
  textPrimary: '#E6E9EE',
  textSecondary: '#9AA4B2',
  accent: '#FF5F05',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  bg: { ...StyleSheet.absoluteFillObject },
  gradientLayer: {
    position: 'absolute',
    width: '120%',
    height: 280,
    left: '-10%',
    right: '-10%',
    borderRadius: 24,
    opacity: 0.55,
    backgroundColor: 'rgba(255,95,5,0.18)',
  },
  layerTop: { top: -40, transform: [{ rotate: '-6deg' }] },
  layerBottom: { bottom: -60, backgroundColor: 'rgba(88,155,255,0.14)', transform: [{ rotate: '5deg' }] },

  container: { flex: 1, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },

  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: COLORS.glass,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.glassStroke,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },

  header: { marginBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { marginTop: 6, color: COLORS.textSecondary, fontSize: 14 },

  field: { marginTop: 14 },
  label: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.inputStroke,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },

  primaryButton: {
    backgroundColor: COLORS.accent,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: COLORS.white, fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },

  secondaryButton: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.inputStroke,
    backgroundColor: 'transparent',
  },
  secondaryText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },

  footnote: { color: COLORS.textSecondary, fontSize: 12, marginTop: 16 },
});
