import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip, UserProfile } from '../types';
import AppHeader from '../components/AppHeader';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { userId } = useParams();

  const targetUserId = userId || (isDummyMode ? 'test-user-1' : user?.id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      try {
        const viewerId = isDummyMode ? 'test-user-1' : user?.id;
        const profileData = await apiFetch<UserProfile>(
          `/profiles/${targetUserId}?viewer_id=${viewerId ?? ''}`
        );
        const tripsData = await apiFetch<Trip[]>(
          `/profiles/${targetUserId}/trips?viewer_id=${viewerId ?? ''}`
        );
        setProfile(profileData);
        setTrips(tripsData);
      } catch (err) {
        console.error(err);
        setProfile(null);
        setTrips([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [targetUserId, user?.id]);

  if (loading) return <div style={{ padding: 24 }}>Loading profile...</div>;
  if (!profile) return <div style={{ padding: 24 }}>Profile not found.</div>;

  const isOwnProfile = isDummyMode || user?.id === profile.id;

  return (
  <>
    <AppHeader />

    <div style={{ padding: 24, width: '100%', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>{profile.username}</h1>
        <p style={{ margin: 0 }}>visibility: {profile.visibility}</p>
        {profile.bio && <p>{profile.bio}</p>}
      </div>

      <h2>Trips</h2>
      {trips.length === 0 ? (
        <p>No trips yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {trips.map((trip) => (
            <Link
              key={trip.id}
              to={`/trips/${trip.id}`}
              style={{
                border: '1px solid #444',
                borderRadius: 12,
                padding: 16,
                display: 'block',
              }}
            >
              <h3 style={{ marginTop: 0 }}>{trip.title}</h3>
              <p style={{ margin: '8px 0' }}>start: {trip.start_location_name}</p>
              <p style={{ margin: '8px 0' }}>status: {trip.status}</p>
              <p style={{ margin: '8px 0' }}>visibility: {trip.visibility}</p>
              <p style={{ margin: '8px 0' }}>legs: {trip.legs?.length ?? 0}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

export default ProfilePage;