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
import Icon from '../components/Icon';
import { useAuth, UserRole } from '../context/AuthContext';

export default function WelcomeScreen() {
  const { user, isLoading, login } = useAuth();
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is already logged in, redirect to their dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.role}`);
    }
  }, [user, isLoading]);

  const handleRoleSelect = async (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Select Option', 'Please select an option above');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(name.trim(), selectedRole);
      router.replace(`/${selectedRole}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to continue. Please try again.');
    } finally {
      setIsSubmitting(false);
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
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>SHINIKO</Text>
          <Text style={styles.tagline}>Exterior Car Wash • £25</Text>
        </View>

        <View style={styles.content}>
          {/* Role Selection */}
          <TouchableOpacity 
            style={[styles.roleCard, selectedRole === 'customer' && styles.roleCardSelected]}
            onPress={() => handleRoleSelect('customer')}
            activeOpacity={0.8}
          >
            <Icon name="car-sport" size={32} color={selectedRole === 'customer' ? '#00D4AA' : '#666'} />
            <Text style={[styles.roleTitle, selectedRole === 'customer' && styles.roleTitleSelected]}>
              Get a wash
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleCard, selectedRole === 'washer' && styles.roleCardSelected]}
            onPress={() => handleRoleSelect('washer')}
            activeOpacity={0.8}
          >
            <Icon name="water" size={32} color={selectedRole === 'washer' ? '#007AFF' : '#666'} />
            <Text style={[styles.roleTitle, selectedRole === 'washer' && styles.roleTitleSelected]}>
              Wash cars
            </Text>
          </TouchableOpacity>

          {/* Name Input - Always visible */}
          <TextInput
            style={styles.nameInput}
            placeholder="Your name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!name.trim() || !selectedRole || isSubmitting) && styles.continueButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!name.trim() || !selectedRole || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>On-demand mobile car wash</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#00D4AA',
    marginTop: 8,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    gap: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardSelected: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
  },
  roleTitleSelected: {
    color: '#FFF',
  },
  nameInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    fontSize: 18,
    color: '#FFF',
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  footerText: {
    fontSize: 13,
    color: '#555',
  },
});
