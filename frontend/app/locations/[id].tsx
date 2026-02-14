import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CarWashLocation {
  id: string;
  name: string;
  description?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  phone?: string;
  email?: string;
  website?: string;
  rating: number;
  review_count: number;
  services: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  amenities: string[];
  payment_methods: string[];
  operating_hours?: any;
}

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams();
  const [location, setLocation] = useState<CarWashLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocation();
  }, [id]);

  const fetchLocation = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/locations/${id}`);
      setLocation(response.data);
    } catch (error) {
      console.error('Error fetching location:', error);
      Alert.alert('Error', 'Failed to load location details');
    } finally {
      setLoading(false);
    }
  };

  const openDirections = () => {
    if (!location) return;
    const { latitude, longitude } = location.location;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    });
  };

  const callLocation = () => {
    if (location?.phone) {
      Linking.openURL(`tel:${location.phone}`);
    }
  };

  const openWebsite = () => {
    if (location?.website) {
      let url = location.website;
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      Linking.openURL(url);
    }
  };

  const sendEmail = () => {
    if (location?.email) {
      Linking.openURL(`mailto:${location.email}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      </SafeAreaView>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Location not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{location.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Info Card */}
        <View style={styles.mainCard}>
          <Text style={styles.businessName}>{location.name}</Text>
          
          {location.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#FFB800" />
              <Text style={styles.ratingText}>{location.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({location.review_count} reviews)</Text>
            </View>
          )}

          {location.description && (
            <Text style={styles.description}>{location.description}</Text>
          )}

          {/* Address */}
          <TouchableOpacity style={styles.addressRow} onPress={openDirections}>
            <Ionicons name="location" size={20} color="#00D4AA" />
            <Text style={styles.addressText}>{location.location.address || 'View on map'}</Text>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={openDirections}>
            <View style={styles.actionIcon}>
              <Ionicons name="navigate" size={24} color="#00D4AA" />
            </View>
            <Text style={styles.actionText}>Directions</Text>
          </TouchableOpacity>

          {location.phone && (
            <TouchableOpacity style={styles.actionButton} onPress={callLocation}>
              <View style={styles.actionIcon}>
                <Ionicons name="call" size={24} color="#00D4AA" />
              </View>
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
          )}

          {location.website && (
            <TouchableOpacity style={styles.actionButton} onPress={openWebsite}>
              <View style={styles.actionIcon}>
                <Ionicons name="globe" size={24} color="#00D4AA" />
              </View>
              <Text style={styles.actionText}>Website</Text>
            </TouchableOpacity>
          )}

          {location.email && (
            <TouchableOpacity style={styles.actionButton} onPress={sendEmail}>
              <View style={styles.actionIcon}>
                <Ionicons name="mail" size={24} color="#00D4AA" />
              </View>
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Services */}
        {location.services && location.services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services & Pricing</Text>
            {location.services.map((service, index) => (
              <View key={index} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.serviceDesc}>{service.description}</Text>
                  )}
                </View>
                <Text style={styles.servicePrice}>${service.price.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Amenities */}
        {location.amenities && location.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {location.amenities.map((amenity, index) => (
                <View key={index} style={styles.amenityBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00D4AA" />
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment Methods */}
        {location.payment_methods && location.payment_methods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.paymentRow}>
              {location.payment_methods.map((method, index) => (
                <View key={index} style={styles.paymentBadge}>
                  <Ionicons 
                    name={method.toLowerCase().includes('card') ? 'card' : 'cash'} 
                    size={16} 
                    color="#888" 
                  />
                  <Text style={styles.paymentText}>{method}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          {location.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={callLocation}>
              <Ionicons name="call-outline" size={20} color="#888" />
              <Text style={styles.contactText}>{location.phone}</Text>
            </TouchableOpacity>
          )}
          {location.email && (
            <TouchableOpacity style={styles.contactRow} onPress={sendEmail}>
              <Ionicons name="mail-outline" size={20} color="#888" />
              <Text style={styles.contactText}>{location.email}</Text>
            </TouchableOpacity>
          )}
          {location.website && (
            <TouchableOpacity style={styles.contactRow} onPress={openWebsite}>
              <Ionicons name="globe-outline" size={20} color="#888" />
              <Text style={styles.contactText}>{location.website}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.directionsButtonLarge} onPress={openDirections}>
          <Ionicons name="navigate" size={24} color="#0A0A0A" />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
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
  errorText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  mainCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  businessName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ratingText: {
    color: '#FFB800',
    fontSize: 18,
    fontWeight: '700',
  },
  reviewCount: {
    color: '#666',
    fontSize: 14,
  },
  description: {
    color: '#AAA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  addressText: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#888',
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  serviceDesc: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  servicePrice: {
    color: '#00D4AA',
    fontSize: 18,
    fontWeight: '700',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  amenityText: {
    color: '#FFF',
    fontSize: 14,
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  paymentText: {
    color: '#888',
    fontSize: 14,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  contactText: {
    color: '#00D4AA',
    fontSize: 15,
  },
  bottomBar: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  directionsButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4AA',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  directionsButtonText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
  },
});
