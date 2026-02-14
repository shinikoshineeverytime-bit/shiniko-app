import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import MapView, { MapViewHandle } from '../../components/MapView';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Job {
  id: string;
  customer_id: string;
  customer_name: string;
  washer_id?: string;
  washer_name?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  status: string;
  created_at: string;
  price: number;
}

export default function WasherHomeScreen() {
  const { user, logout } = useAuth();
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'my_jobs'>('available');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [washerLocation, setWasherLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<MapViewHandle>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    getLocation();
    fetchJobs();
  }, [user]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to see nearby jobs');
        setWasherLocation({ latitude: 40.7128, longitude: -74.0060 });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setWasherLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      setWasherLocation({ latitude: 40.7128, longitude: -74.0060 });
    }
  };

  const fetchJobs = async () => {
    if (!user) return;
    try {
      const [availableRes, myJobsRes] = await Promise.all([
        axios.get(`${API_URL}/api/jobs/available`),
        axios.get(`${API_URL}/api/jobs?washer_id=${user.id}`),
      ]);
      setAvailableJobs(availableRes.data);
      setMyJobs(myJobsRes.data.filter((j: Job) => j.status !== 'completed' && j.status !== 'cancelled'));
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, []);

  const acceptJob = async (jobId: string) => {
    if (!user) return;
    try {
      await axios.put(`${API_URL}/api/jobs/${jobId}/accept`, {
        washer_id: user.id,
        washer_name: user.name,
      });
      Alert.alert('Success', 'Job accepted! Navigate to the customer.');
      fetchJobs();
      setActiveTab('my_jobs');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to accept job');
    }
  };

  const startJob = async (jobId: string) => {
    try {
      await axios.put(`${API_URL}/api/jobs/${jobId}/start`);
      Alert.alert('Started', 'Wash is now in progress.');
      fetchJobs();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start job');
    }
  };

  const completeJob = async (jobId: string) => {
    Alert.alert(
      'Complete Job',
      'Mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await axios.put(`${API_URL}/api/jobs/${jobId}/complete`);
              Alert.alert('Completed!', 'Great job! The wash has been completed.');
              fetchJobs();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to complete job');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const calculateDistance = (jobLat: number, jobLng: number) => {
    if (!washerLocation) return 'N/A';
    const R = 6371;
    const dLat = (jobLat - washerLocation.latitude) * (Math.PI / 180);
    const dLng = (jobLng - washerLocation.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(washerLocation.latitude * (Math.PI / 180)) *
        Math.cos(jobLat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const getJobMarkers = () => {
    const jobs = activeTab === 'available' ? availableJobs : myJobs;
    return jobs.map(job => ({
      id: job.id,
      latitude: job.location.latitude,
      longitude: job.location.longitude,
      title: job.location.address || 'Job Location',
      type: 'customer' as const,
    }));
  };

  const viewJobOnMap = (job: Job) => {
    setShowMap(true);
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: job.location.latitude,
          longitude: job.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }, 500);
  };

  const renderAvailableJob = ({ item }: { item: Job }) => (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <View style={styles.jobBadge}>
          <Ionicons name="car" size={16} color="#00D4AA" />
          <Text style={styles.jobBadgeText}>New Request</Text>
        </View>
        <Text style={styles.jobTime}>{formatTime(item.created_at)}</Text>
      </View>

      <View style={styles.customerInfo}>
        <Ionicons name="person" size={16} color="#888" />
        <Text style={styles.customerName}>{item.customer_name}</Text>
      </View>

      <TouchableOpacity style={styles.jobLocation} onPress={() => viewJobOnMap(item)}>
        <Ionicons name="location" size={20} color="#888" />
        <Text style={styles.jobAddress} numberOfLines={2}>
          {item.location.address || 'Location available'}
        </Text>
        <Ionicons name="map-outline" size={18} color="#00D4AA" />
      </TouchableOpacity>

      <View style={styles.jobFooter}>
        <View style={styles.jobInfo}>
          <View style={styles.infoItem}>
            <Ionicons name="navigate" size={16} color="#888" />
            <Text style={styles.infoText}>
              {calculateDistance(item.location.latitude, item.location.longitude)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cash" size={16} color="#00D4AA" />
            <Text style={[styles.infoText, { color: '#00D4AA' }]}>${item.price.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptJob(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMyJob = ({ item }: { item: Job }) => {
    const getStatusColor = () => {
      switch (item.status) {
        case 'accepted': return '#FFB800';
        case 'in_progress': return '#007AFF';
        default: return '#888';
      }
    };

    const getStatusText = () => {
      switch (item.status) {
        case 'accepted': return 'Navigate to Customer';
        case 'in_progress': return 'Washing...';
        default: return item.status;
      }
    };

    return (
      <View style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Ionicons name="person" size={16} color="#888" />
          <Text style={styles.customerName}>{item.customer_name}</Text>
        </View>

        <TouchableOpacity style={styles.jobLocation} onPress={() => viewJobOnMap(item)}>
          <Ionicons name="location" size={20} color="#888" />
          <Text style={styles.jobAddress} numberOfLines={2}>
            {item.location.address || 'Location available'}
          </Text>
          <Ionicons name="map-outline" size={18} color="#00D4AA" />
        </TouchableOpacity>

        <View style={styles.jobFooter}>
          <View style={styles.jobInfo}>
            <View style={styles.infoItem}>
              <Ionicons name="cash" size={16} color="#00D4AA" />
              <Text style={[styles.infoText, { color: '#00D4AA' }]}>${item.price.toFixed(2)}</Text>
            </View>
          </View>

          {item.status === 'accepted' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
              onPress={() => startJob(item.id)}
            >
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>Start Wash</Text>
            </TouchableOpacity>
          )}

          {item.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#00D4AA' }]}
              onPress={() => completeJob(item.id)}
            >
              <Ionicons name="checkmark" size={18} color="#0A0A0A" />
              <Text style={[styles.actionButtonText, { color: '#0A0A0A' }]}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={activeTab === 'available' ? 'car-outline' : 'briefcase-outline'} 
        size={64} 
        color="#333" 
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'available' ? 'No jobs available' : 'No active jobs'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'available' 
          ? 'Pull down to refresh or check back soon' 
          : 'Accept a job to get started'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={showMap ? () => setShowMap(false) : handleLogout} style={styles.headerButton}>
          <Ionicons name={showMap ? 'arrow-back' : 'log-out-outline'} size={24} color={showMap ? '#FFF' : '#FF3B30'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SHINIKO</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.mapToggle} 
            onPress={() => setShowMap(!showMap)}
          >
            <Ionicons name={showMap ? 'list' : 'map'} size={20} color="#00D4AA" />
          </TouchableOpacity>
          <View style={styles.userBadge}>
            <Ionicons name="person" size={12} color="#00D4AA" />
            <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Available ({availableJobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my_jobs' && styles.activeTab]}
          onPress={() => setActiveTab('my_jobs')}
        >
          <Text style={[styles.tabText, activeTab === 'my_jobs' && styles.activeTabText]}>
            My Jobs ({myJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map View */}
      {showMap && washerLocation && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            location={washerLocation}
            style={styles.map}
            markers={getJobMarkers()}
          />
        </View>
      )}

      {/* Job List */}
      {!showMap && (
        <FlatList
          data={activeTab === 'available' ? availableJobs : myJobs}
          renderItem={activeTab === 'available' ? renderAvailableJob : renderMyJob}
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
      )}
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
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    maxWidth: 80,
  },
  userName: {
    fontSize: 11,
    color: '#00D4AA',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#2A2A2A',
  },
  activeTab: {
    borderBottomColor: '#00D4AA',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  activeTabText: {
    color: '#00D4AA',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  jobCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  jobBadgeText: {
    fontSize: 12,
    color: '#00D4AA',
    fontWeight: '600',
  },
  jobTime: {
    fontSize: 12,
    color: '#666',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jobLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  jobAddress: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  acceptButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
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
    textAlign: 'center',
  },
});
