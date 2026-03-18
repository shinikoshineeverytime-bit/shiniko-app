import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      <View style={styles.container}>
        <LinearGradient
          colors={['#0d0d0d', '#141414', '#0d0d0d']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0a0a0a', '#111111', '#0d0d0d']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Subtle radial glow behind content */}
      <View style={styles.glowContainer}>
        <LinearGradient
          colors={['rgba(0, 212, 170, 0.08)', 'transparent']}
          style={styles.glowEffect}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
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
            {/* Get a wash card */}
            <TouchableOpacity 
              style={styles.optionCardWrapper}
              onPress={() => handleSelect('customer')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1a1a1a', '#151515']}
                style={styles.optionCard}
              >
                {/* Subtle glow on card */}
                <View style={styles.cardGlow} />
                
                <View style={styles.optionIconContainer}>
                  <LinearGradient
                    colors={['rgba(0, 212, 170, 0.2)', 'rgba(0, 212, 170, 0.05)']}
                    style={styles.iconGradient}
                  >
                    <Icon name="car-sport" size={32} color="#00D4AA" />
                  </LinearGradient>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Get a wash</Text>
                  <Text style={styles.optionDesc}>Book a washer to come to you</Text>
                </View>
                <Icon name="chevron-forward" size={22} color="#3a3a3a" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Wash cars card */}
            <TouchableOpacity 
              style={styles.optionCardWrapper}
              onPress={() => handleSelect('washer')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1a1a1a', '#151515']}
                style={styles.optionCard}
              >
                <View style={styles.optionIconContainer}>
                  <LinearGradient
                    colors={['rgba(0, 122, 255, 0.2)', 'rgba(0, 122, 255, 0.05)']}
                    style={styles.iconGradient}
                  >
                    <Icon name="water" size={32} color="#007AFF" />
                  </LinearGradient>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Wash cars</Text>
                  <Text style={styles.optionDesc}>Earn money washing cars</Text>
                </View>
                <Icon name="chevron-forward" size={22} color="#3a3a3a" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerDivider} />
            <Text style={styles.footerText}>On-demand mobile car wash</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  glowEffect: {
    flex: 1,
    borderBottomLeftRadius: 200,
    borderBottomRightRadius: 200,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 60,
  },
  brandName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 10,
    textShadowColor: 'rgba(0, 212, 170, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 14,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  priceBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.2)',
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
  optionCardWrapper: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    minHeight: 96,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  optionIconContainer: {
    width: 60,
    height: 60,
  },
  iconGradient: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 19,
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
  footerDivider: {
    width: 40,
    height: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#444',
  },
});
