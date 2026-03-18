import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import Icon from '../../components/Icon';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function CustomerScreen() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [activeJob, setActiveJob] = useState<any>(null);
  
  // Vehicle info - inline
  const [carReg, setCarReg] = useState('');
  const [carColour, setCarColour] = useState('');

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    getLocation();
    checkActiveJob();
  }, [user]);

  // Poll for job updates
  useEffect(() => {
    if (activeJob && activeJob.status !== 'completed') {
      const interval = setInterval(checkActiveJob, 5000);
      return () => clearInterval(interval);
    }
  }, [activeJob]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({ latitude: 51.5074, longitude: -0.1278 });
        setAddress('London, UK');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      try {
        const [addr] = await Location.reverseGeocodeAsync(coords);
        if (addr) {
          const parts = [addr.street, addr.city].filter(Boolean);
          setAddress(parts.join(', ') || 'Current Location');
        }
      } catch {
        setAddress('Current Location');
      }
    } catch (error) {
      setLocation({ latitude: 51.5074, longitude: -0.1278 });
      setAddress('London, UK');
    } finally {
      setLoading(false);
    }
  };

  const checkActiveJob = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/api/jobs?customer_id=${user.id}`);
      const active = response.data.find(
        (job: any) => !['completed', 'cancelled'].includes(job.status)
      );
      setActiveJob(active || null);
    } catch (error) {
      console.error('Error checking jobs:', error);
    }
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
    }
  };

  const handleBook = async () => {
    if (!location || !user) {
      showAlert('Error', 'Location not available');
      return;
    }

    if (!carReg.trim()) {
      showAlert('Car Registration Required', 'Please enter your car registration so the washer can find your car');
      return;
    }

    if (!carColour.trim()) {
      showAlert('Car Colour Required', 'Please enter your car colour');
      return;
    }

    // Confirm payment
    const confirmBooking = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Confirm booking?\n\nExterior Car Wash: £25.00'));
        } else {
          Alert.alert(
            'Confirm Booking',
            'Exterior Car Wash: £25.00',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Pay £25', onPress: () => resolve(true) },
            ]
          );
        }
      });
    };

    const confirmed = await confirmBooking();
    if (!confirmed) return;

    setBooking(true);
    try {
      // Create payment intent
      const paymentResponse = await axios.post(`${API_URL}/api/payments/create-intent`, {
        customer_id: user.id,
      });

      // Confirm payment
      await axios.post(`${API_URL}/api/payments/confirm/${paymentResponse.data.payment_intent_id}`);

      // Create job
      const jobResponse = await axios.post(`${API_URL}/api/jobs`, {
        customer_id: user.id,
        customer_name: user.name,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address,
        },
        vehicle: {
          registration: carReg.trim().toUpperCase(),
          colour: carColour.trim(),
        },
        payment_intent_id: paymentResponse.data.payment_intent_id,
      });

      setActiveJob(jobResponse.data);
      showAlert('Booked!', 'A washer will be with you soon');
    } catch (error) {
      console.error('Booking error:', error);
      showAlert('Error', 'Failed to book. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const cancelJob = async () => {
    if (!activeJob) return;

    const confirmCancel = (): Promise<boolean> => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm('Cancel this booking?'));
        } else {
          Alert.alert('Cancel Booking', 'Are you sure?', [
            { text: 'No', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => resolve(true) },
          ]);
        }
      });
    };

    const confirmed = await confirmCancel();
    if (!confirmed) return;

    try {
      await axios.put(`${API_URL}/api/jobs/${activeJob.id}/cancel`);
      setActiveJob(null);
    } catch (error) {
      showAlert('Error', 'Failed to cancel');
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'requested': return { text: 'Finding washer...', color: '#FFB800' };
      case 'accepted': return { text: 'Washer on the way', color: '#00D4AA' };
      case 'in_progress': return { text: 'Washing your car', color: '#007AFF' };
      default: return { text: status, color: '#888' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogout}>
            <Icon name="log-out-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SHINIKO</Text>
          <View style={styles.userBadge}>
            <Text style={styles.userName}>{user?.name}</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Location */}
          <View style={styles.locationCard}>
            <Icon name="location" size={20} color="#00D4AA" />
            <Text style={styles.locationText} numberOfLines={1}>{address}</Text>
          </View>

          {activeJob ? (
            // Active Job View
            <View style={styles.activeJobCard}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusDisplay(activeJob.status).color + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusDisplay(activeJob.status).color }]} />
                <Text style={[styles.statusText, { color: getStatusDisplay(activeJob.status).color }]}>
                  {getStatusDisplay(activeJob.status).text}
                </Text>
              </View>

              <View style={styles.jobDetails}>
                <Text style={styles.jobCar}>{activeJob.vehicle?.registration}</Text>
                <Text style={styles.jobPrice}>£25.00</Text>
              </View>

              {activeJob.washer_name && (
                <Text style={styles.washerName}>Washer: {activeJob.washer_name}</Text>
              )}

              {(activeJob.status === 'accepted' || activeJob.status === 'in_progress') && (
                <TouchableOpacity 
                  style={styles.chatButton}
                  onPress={() => router.push(`/chat/${activeJob.id}`)}
                >
                  <Icon name="chatbubble" size={18} color="#FFF" />
                  <Text style={styles.chatButtonText}>Message Washer</Text>
                </TouchableOpacity>
              )}

              {activeJob.status === 'requested' && (
                <TouchableOpacity style={styles.cancelButton} onPress={cancelJob}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // Booking Form
            <>
              <Text style={styles.sectionTitle}>Your Car</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Registration (e.g. AB12 CDE)"
                placeholderTextColor="#666"
                value={carReg}
                onChangeText={setCarReg}
                autoCapitalize="characters"
              />

              <TextInput
                style={styles.input}
                placeholder="Colour (e.g. Black, White, Silver)"
                placeholderTextColor="#666"
                value={carColour}
                onChangeText={setCarColour}
                autoCapitalize="words"
              />

              {/* Price & Book */}
              <View style={styles.priceCard}>
                <View>
                  <Text style={styles.serviceName}>Exterior Wash</Text>
                  <Text style={styles.serviceDesc}>Full exterior clean</Text>
                </View>
                <Text style={styles.price}>£25</Text>
              </View>

              <TouchableOpacity
                style={[styles.bookButton, booking && styles.bookButtonDisabled]}
                onPress={handleBook}
                disabled={booking}
              >
                {booking ? (
                  <ActivityIndicator color="#0A0A0A" />
                ) : (
                  <Text style={styles.bookButtonText}>Book Now • £25</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
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
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 3,
  },
  userBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  userName: {
    fontSize: 13,
    color: '#00D4AA',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 24,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 12,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  serviceDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00D4AA',
  },
  bookButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 30,
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  activeJobCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  jobDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobCar: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  jobPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00D4AA',
  },
  washerName: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
