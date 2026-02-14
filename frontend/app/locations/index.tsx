import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
  rating: number;
  review_count: number;
  services: Array<{
    name: string;
    price: number;
  }>;
  amenities: string[];
  operating_hours?: any;
}

export default function LocationsScreen() {
  const [locations, setLocations] = useState<CarWashLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);

  useEffect(() => {
    getUserLocation();
    fetchLocations();
  }, []);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const params = userLocation 
        ? `?lat=${userLocation.latitude}&lng=${userLocation.longitude}` 
        : '';
      const response = await axios.get(`${API_URL}/api/locations${params}`);
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLocations();
  }, [userLocation]);

  const calculateDistance = (lat: number, lng: number) => {
    if (!userLocation) return null;
    const R = 6371;
    const dLat = (lat - userLocation.latitude) * (Math.PI / 180);
    const dLng = (lng - userLocation.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.latitude * (Math.PI / 180)) *
        Math.cos(lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`;
  };

  const openDirections = (location: CarWashLocation) => {
    const { latitude, longitude } = location.location;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    Linking.openURL(url as string).catch(() => {
      // Fallback to web URL
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    });
  };

  const callLocation = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getMinPrice = (services: Array<{price: number}>) => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => s.price));
  };

  const renderLocation = ({ item }: { item: CarWashLocation }) => {
    const distance = calculateDistance(item.location.latitude, item.location.longitude);
    const minPrice = getMinPrice(item.services);

    return (
      <TouchableOpacity 
        style={styles.locationCard}
        onPress={() => router.push({ pathname: '/locations/[id]', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
            {item.rating > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({item.review_count})</Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          )}
        </View>

        <View style={styles.locationInfo}>
          <Ionicons name="location" size={16} color="#888" />
          <Text style={styles.address} numberOfLines={1}>
            {item.location.address || 'Address available'}
          </Text>
          {distance && (
            <Text style={styles.distance}>{distance}</Text>
          )}
        </View>

        {item.amenities && item.amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {item.amenities.slice(0, 3).map((amenity, index) => (
              <View key={index} style={styles.amenityBadge}>
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
            {item.amenities.length > 3 && (
              <Text style={styles.moreAmenities}>+{item.amenities.length - 3}</Text>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.priceInfo}>
            {minPrice && (
              <>
                <Text style={styles.priceLabel}>From</Text>
                <Text style={styles.priceValue}>${minPrice.toFixed(2)}</Text>
              </>
            )}
          </View>
          <View style={styles.actionButtons}>
            {item.phone && (
              <TouchableOpacity 
                style={styles.callButton}
                onPress={() => callLocation(item.phone!)}
              >
                <Ionicons name="call" size={18} color="#00D4AA" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.directionsButton}
              onPress={() => openDirections(item)}
            >
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={styles.directionsText}>Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="business-outline" size={64} color="#333" />
      <Text style={styles.emptyTitle}>No car washes found</Text>
      <Text style={styles.emptySubtitle}>Be the first to add a location!</Text>
      <TouchableOpacity 
        style={styles.addFirstButton}
        onPress={() => router.push('/locations/add')}
      >
        <Ionicons name="add" size={20} color="#0A0A0A" />
        <Text style={styles.addFirstButtonText}>Add Car Wash</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Finding car washes...</Text>
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
        <Text style={styles.headerTitle}>Car Washes</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/locations/add')}
        >
          <Ionicons name="add" size={24} color="#00D4AA" />
        </TouchableOpacity>
      </View>

      {/* Location Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {locations.length} {locations.length === 1 ? 'location' : 'locations'} found
        </Text>
      </View>

      {/* Locations List */}
      <FlatList
        data={locations}
        renderItem={renderLocation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4AA"
            colors={['#00D4AA']}
          />
        }
      />
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
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  countText: {
    color: '#888',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  locationCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#FFB800',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewCount: {
    color: '#666',
    fontSize: 12,
  },
  description: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  address: {
    color: '#AAA',
    fontSize: 14,
    flex: 1,
  },
  distance: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  amenityBadge: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amenityText: {
    color: '#888',
    fontSize: 12,
  },
  moreAmenities: {
    color: '#666',
    fontSize: 12,
    alignSelf: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 12,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceLabel: {
    color: '#666',
    fontSize: 12,
  },
  priceValue: {
    color: '#00D4AA',
    fontSize: 20,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4AA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  directionsText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4AA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginTop: 24,
  },
  addFirstButtonText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
});
