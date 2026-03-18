import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from '../../components/Icon';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Conditionally import Stripe only on native
let useStripe: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useStripe = stripeModule.useStripe;
  } catch (e) {
    console.log('Stripe not available');
  }
}

export default function PaymentScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  
  // Parse params
  const customerId = params.customerId as string;
  const customerName = params.customerName as string;
  const latitude = parseFloat(params.latitude as string);
  const longitude = parseFloat(params.longitude as string);
  const address = params.address as string;
  const vehicleData = params.vehicle ? JSON.parse(params.vehicle as string) : null;

  // Stripe hooks (only on native)
  const stripe = Platform.OS !== 'web' && useStripe ? useStripe() : null;
  const initPaymentSheet = stripe?.initPaymentSheet;
  const presentPaymentSheet = stripe?.presentPaymentSheet;

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      setInitializing(true);
      
      // Create payment intent on backend
      const response = await axios.post(`${API_URL}/api/payments/create-intent`, {
        customer_id: customerId,
      });

      const { client_secret, payment_intent_id } = response.data;
      setClientSecret(client_secret);
      setPaymentIntentId(payment_intent_id);

      // Initialize Stripe PaymentSheet (only on native)
      if (Platform.OS !== 'web' && initPaymentSheet && client_secret) {
        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: client_secret,
          merchantDisplayName: 'Shiniko Car Wash',
          style: 'alwaysDark',
          appearance: {
            colors: {
              primary: '#00D4AA',
              background: '#1A1A1A',
              componentBackground: '#2A2A2A',
              componentText: '#FFFFFF',
              primaryText: '#FFFFFF',
              secondaryText: '#888888',
              icon: '#00D4AA',
            },
          },
        });

        if (error) {
          console.error('PaymentSheet init error:', error);
          Alert.alert('Error', 'Failed to initialize payment. Please try again.');
        } else {
          setPaymentReady(true);
        }
      } else if (Platform.OS === 'web') {
        // On web, we'll use a simplified flow
        setPaymentReady(true);
      }
    } catch (error: any) {
      console.error('Payment init error:', error);
      Alert.alert('Error', 'Failed to set up payment. Please try again.');
    } finally {
      setInitializing(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentReady || !clientSecret) {
      Alert.alert('Error', 'Payment not ready. Please wait.');
      return;
    }

    setLoading(true);

    try {
      if (Platform.OS === 'web') {
        // Web: Simulate payment for testing (in production, use Stripe.js)
        const confirmed = window.confirm(
          'TEST MODE: Simulate successful payment?\n\nIn production, this would show the Stripe payment form.'
        );
        
        if (confirmed) {
          await createJobAfterPayment();
        }
      } else if (presentPaymentSheet) {
        // Native: Show Stripe PaymentSheet
        const { error } = await presentPaymentSheet();

        if (error) {
          if (error.code === 'Canceled') {
            // User cancelled - do nothing
          } else {
            Alert.alert('Payment Failed', error.message);
          }
        } else {
          // Payment successful - create the job
          await createJobAfterPayment();
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createJobAfterPayment = async () => {
    try {
      // Confirm payment on backend
      if (paymentIntentId) {
        await axios.post(`${API_URL}/api/payments/confirm/${paymentIntentId}`);
      }

      // Create the wash job
      const jobResponse = await axios.post(`${API_URL}/api/jobs`, {
        customer_id: customerId,
        customer_name: customerName,
        location: {
          latitude,
          longitude,
          address,
        },
        vehicle: vehicleData,
        payment_intent_id: paymentIntentId,
      });

      // Navigate back to customer screen with success
      if (Platform.OS === 'web') {
        window.alert('Payment successful! Your wash request has been sent to nearby washers.');
      } else {
        Alert.alert(
          'Payment Successful!',
          'Your wash request has been sent to nearby washers. You\'ll be notified when someone accepts.',
          [{ text: 'OK' }]
        );
      }
      
      router.replace('/customer');
    } catch (error: any) {
      console.error('Job creation error:', error);
      Alert.alert('Error', 'Payment was successful but failed to create job. Please contact support.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Setting up payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Icon name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.serviceInfo}>
              <Icon name="water" size={24} color="#00D4AA" />
              <Text style={styles.serviceName}>Exterior Car Wash</Text>
            </View>
          </View>

          {vehicleData && (
            <View style={styles.vehicleInfo}>
              <Icon name="car" size={18} color="#888" />
              <Text style={styles.vehicleText}>
                {vehicleData.registration} • {vehicleData.colour}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Service</Text>
            <Text style={styles.priceValue}>$25.00</Text>
          </View>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform fee</Text>
            <Text style={styles.feeValue}>$1.25</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>$25.00</Text>
          </View>
        </View>

        {/* Washer Payout Info */}
        <View style={styles.payoutInfo}>
          <Icon name="person" size={16} color="#888" />
          <Text style={styles.payoutText}>Washer receives $23.75</Text>
        </View>

        {/* Payment Method Info */}
        <View style={styles.paymentMethodCard}>
          <Icon name="card" size={24} color="#00D4AA" />
          <View style={styles.paymentMethodInfo}>
            <Text style={styles.paymentMethodTitle}>Secure Payment</Text>
            <Text style={styles.paymentMethodSubtitle}>
              {Platform.OS === 'web' 
                ? 'Test mode - tap Pay to simulate'
                : 'Powered by Stripe'}
            </Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, (!paymentReady || loading) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={!paymentReady || loading}
        >
          {loading ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <>
              <Icon name="checkmark" size={24} color="#0A0A0A" />
              <Text style={styles.payButtonText}>Pay $25.00</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Icon name="lock-closed" size={14} color="#666" />
          <Text style={styles.securityText}>
            Your payment is secure and encrypted
          </Text>
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
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  summaryRow: {
    marginBottom: 12,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceName: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingLeft: 36,
  },
  vehicleText: {
    fontSize: 14,
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#888',
  },
  priceValue: {
    fontSize: 14,
    color: '#FFF',
  },
  feeValue: {
    fontSize: 14,
    color: '#888',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00D4AA',
  },
  payoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  payoutText: {
    fontSize: 13,
    color: '#888',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  paymentMethodSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 12,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#888',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
  },
});
