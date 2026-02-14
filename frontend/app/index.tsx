import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, UserRole } from '../context/AuthContext';

export default function WelcomeScreen() {
  const { user, isLoading, login } = useAuth();
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);

  // If user is already logged in, redirect to their dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [user, isLoading]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setShowNameInput(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Role Required', 'Please select how you want to use Shiniko');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(name.trim(), selectedRole);
      router.replace(`/${selectedRole}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setShowNameInput(false);
    setSelectedRole(null);
    setName('');
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
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>SHINIKO</Text>
          <Text style={styles.tagline}>Shine — Every Time</Text>
        </View>

        <View style={styles.content}>
          {!showNameInput ? (
            // Role Selection
            <>
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
            </>
          ) : (
            // Name Input
            <>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.nameInputSection}>
                <View style={[
                  styles.selectedRoleBadge,
                  { backgroundColor: selectedRole === 'customer' ? 'rgba(0, 212, 170, 0.15)' : 'rgba(0, 122, 255, 0.15)' }
                ]}>
                  <Ionicons 
                    name={selectedRole === 'customer' ? 'car-sport' : 'water'} 
                    size={20} 
                    color={selectedRole === 'customer' ? '#00D4AA' : '#007AFF'} 
                  />
                  <Text style={[
                    styles.selectedRoleText,
                    { color: selectedRole === 'customer' ? '#00D4AA' : '#007AFF' }
                  ]}>
                    {selectedRole === 'customer' ? 'Customer' : 'Washer'}
                  </Text>
                </View>

                <Text style={styles.nameTitle}>What's your name?</Text>
                <Text style={styles.nameSubtitle}>This will be shown to {selectedRole === 'customer' ? 'washers' : 'customers'}</Text>

                <TextInput
                  style={styles.nameInput}
                  placeholder="Enter your name"
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />

                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    (!name.trim() || isSubmitting) && styles.continueButtonDisabled
                  ]}
                  onPress={handleSubmit}
                  disabled={!name.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <>
                      <Text style={styles.continueButtonText}>Get Started</Text>
                      <Ionicons name="arrow-forward" size={20} color="#0A0A0A" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>On-demand exterior car wash</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -8,
  },
  nameInputSection: {
    flex: 1,
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 32,
  },
  selectedRoleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nameTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  nameSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  nameInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 24,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#1A1A1A',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
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
