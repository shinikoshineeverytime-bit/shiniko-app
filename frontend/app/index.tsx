import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

export default function WelcomeScreen() {
  const { user, isLoading, login } = useAuth();

  // If user is already logged in, redirect to their dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [user, isLoading]);

  const handleSelect = async (role: 'customer' | 'washer') => {
    try {
      // Auto-generate a simple user
      await login('User', role);
      router.replace(`/${role}`);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>SHINIKO</Text>
        <Text style={styles.tagline}>Exterior Car Wash • £25</Text>
      </View>

      {/* Options */}
      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.optionCard}
          onPress={() => handleSelect('customer')}
          activeOpacity={0.8}
        >
          <Icon name="car-sport" size={48} color="#00D4AA" />
          <Text style={styles.optionTitle}>Get a wash</Text>
          <Text style={styles.optionDesc}>Book a washer to come to you</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.optionCard, styles.optionCardAlt]}
          onPress={() => handleSelect('washer')}
          activeOpacity={0.8}
        >
          <Icon name="water" size={48} color="#007AFF" />
          <Text style={styles.optionTitle}>Wash cars</Text>
          <Text style={styles.optionDesc}>Earn money washing cars</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>On-demand mobile car wash</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 60,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#00D4AA',
    marginTop: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  optionCardAlt: {
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
  },
  optionDesc: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#555',
  },
});
