import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip, UserProfile } from '../types';
import AppHeader from '../components/AppHeader';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function ProfilePage() {
  const { user } = useAuth();
  const { userId } = useParams();

  const targetUserId = userId || (isDummyMode ? 'test-user-1' : user?.id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!targetUserId) {
        setError("No user id available");
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
      } catch (err: any) {
        console.error("PROFILE LOAD ERROR:", err);

        // try to extract useful message
        const message =
          err?.message ||
          err?.detail ||
          JSON.stringify(err);

        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [targetUserId, user?.id]);

  if (loading) return <div style={{ padding: 24 }}>Loading profile...</div>;

  if (error) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 24 }}>
          <h2>Profile Load Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <AppHeader />
        <div style={{ padding: 24 }}>
          <h2>No profile found</h2>
        </div>
      </>
    );
  }

  const isOwnProfile = isDummyMode || user?.id === profile.id;

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, width: '100%', maxWidth: 1000, margin: '0 auto' }}>
        <h1>{profile.username}</h1>

        <h2>Trips</h2>
        {trips.length === 0 ? (
          <p>No trips yet.</p>
        ) : (
          <div>
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                {trip.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default ProfilePage;