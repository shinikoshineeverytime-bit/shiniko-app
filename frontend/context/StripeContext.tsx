import React, { useEffect, useState } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform, View, ActivityIndicator } from 'react-native';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface StripeProviderWrapperProps {
  children: React.ReactNode;
}

export function StripeProviderWrapper({ children }: StripeProviderWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/payments/config`);
      setPublishableKey(response.data.publishable_key);
    } catch (error) {
      console.error('Error fetching payment config:', error);
      // Fallback to env variable
      setPublishableKey(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
    } finally {
      setLoading(false);
    }
  };

  // Don't use Stripe on web - it needs native modules
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' }}>
        <ActivityIndicator size="large" color="#00D4AA" />
      </View>
    );
  }

  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.shiniko.carwash"
    >
      {children}
    </StripeProvider>
  );
}
