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

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [user, isLoading]);

  const handleSelect = async (role: 'customer' | 'washer') => {
    try {
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
      
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>SHINIKO</Text>
          <View style={styles.taglineContainer}>
            <Text style={styles.tagline}>Exterior Car Wash</Text>
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>£25</Text>
            </View>
          </View>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={styles.optionCard}
            onPress={() => handleSelect('customer')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Icon name="car-sport" size={36} color="#00D4AA" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Get a wash</Text>
              <Text style={styles.optionDesc}>Book a washer to come to you</Text>
            </View>
            <Icon name="chevron-forward" size={24} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionCard}
            onPress={() => handleSelect('washer')}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIconContainer, styles.optionIconAlt]}>
              <Icon name="water" size={36} color="#007AFF" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Wash cars</Text>
              <Text style={styles.optionDesc}>Earn money washing cars</Text>
            </View>
            <Icon name="chevron-forward" size={24} color="#444" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>On-demand mobile car wash</Text>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 50,
  },
  brandName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 8,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  priceBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 16,
    color: '#00D4AA',
    fontWeight: '700',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    minHeight: 88,
  },
  optionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconAlt: {
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  optionDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 13,
    color: '#444',
  },
});
