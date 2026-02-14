import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, StatusBar, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const handleRoleSelect = (role: 'customer' | 'washer') => {
    router.push({ pathname: `/${role}` });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.brandName}>SHINIKO</Text>
        <Text style={styles.tagline}>Shine — Every Time</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Choose how you want to use Shiniko</Text>

        <TouchableOpacity 
          style={styles.roleCard}
          onPress={() => handleRoleSelect('customer')}
          activeOpacity={0.8}
        >
          <View style={styles.roleIconContainer}>
            <Ionicons name="car-sport" size={40} color="#00D4AA" />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>I need a car wash</Text>
            <Text style={styles.roleDescription}>Request an exterior wash at your location</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.roleCard}
          onPress={() => handleRoleSelect('washer')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconContainer, { backgroundColor: 'rgba(0, 122, 255, 0.15)' }]}>
            <Ionicons name="water" size={40} color="#007AFF" />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>I'm a car washer</Text>
            <Text style={styles.roleDescription}>Accept jobs and wash cars nearby</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>On-demand exterior car wash</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#00D4AA',
    marginTop: 8,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  roleIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#888',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#555',
  },
});
