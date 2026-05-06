import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from '../../components/Icon';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams();
  const sessionId = params.session_id as string;
  const [status, setStatus] = useState<'checking' | 'success' | 'error' | 'timeout'>('checking');

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus(sessionId, 0);
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const pollPaymentStatus = async (sid: string, attempts: number) => {
    if (attempts >= 8) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/checkout/status/${sid}`);
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        // Redirect to customer screen after showing success
        setTimeout(() => {
          router.replace('/customer');
        }, 2500);
        return;
      }
      // Keep polling
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
    } catch (error) {
      console.error('Payment status poll error:', error);
      if (attempts < 5) {
        setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
      } else {
        setStatus('error');
      }
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0a', '#0f0f0f', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {status === 'checking' && (
            <>
              <ActivityIndicator size="large" color="#00D4AA" />
              <Text style={styles.title}>Processing Payment...</Text>
              <Text style={styles.subtitle}>Please wait while we confirm your payment</Text>
            </>
          )}

          {status === 'success' && (
            <>
              <View style={styles.successIcon}>
                <LinearGradient
                  colors={['rgba(0, 212, 170, 0.2)', 'rgba(0, 212, 170, 0.05)']}
                  style={styles.iconGradient}
                >
                  <Icon name="checkmark-circle" size={64} color="#00D4AA" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Payment Successful!</Text>
              <Text style={styles.subtitle}>Your wash request has been sent to nearby washers</Text>
              <Text style={styles.redirectText}>Redirecting...</Text>
            </>
          )}

          {status === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <Icon name="close-circle" size={64} color="#FF3B30" />
              </View>
              <Text style={styles.title}>Payment Issue</Text>
              <Text style={styles.subtitle}>There was a problem confirming your payment. Please check your email for confirmation.</Text>
              <Text
                style={styles.linkText}
                onPress={() => router.replace('/customer')}
              >
                Return to home
              </Text>
            </>
          )}

          {status === 'timeout' && (
            <>
              <View style={styles.errorIcon}>
                <Icon name="time" size={64} color="#FFB800" />
              </View>
              <Text style={styles.title}>Taking Longer Than Expected</Text>
              <Text style={styles.subtitle}>Your payment may still be processing. Check back shortly.</Text>
              <Text
                style={styles.linkText}
                onPress={() => router.replace('/customer')}
              >
                Return to home
              </Text>
            </>
          )}
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
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  iconGradient: {
    flex: 1,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  redirectText: {
    fontSize: 13,
    color: '#555',
    marginTop: 24,
  },
  linkText: {
    fontSize: 16,
    color: '#00D4AA',
    fontWeight: '600',
    marginTop: 24,
  },
});
