import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip } from '../types';
import AppHeader from '../components/AppHeader';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

type UserProfileData = {
  user_id: string;
  display_name: string;
  tagline: string;
  date_of_birth: string | null;
  city: string;
  country: string;
  cover_photo_url: string;
  website: string;
};

function ProfilePage() {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();

  const targetUserId = userId || (isDummyMode ? 'test-user-1' : user?.id);

  const [profile, setProfile] = useState<UserProfileData | null>(null);
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
        const profileData = await apiFetch<UserProfileData>(
          `/user-profiles/${targetUserId}`
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

  const isOwnProfile = isDummyMode || user?.id === profile.user_id;

  return (
  <>
    <AppHeader />

    <div style={{ padding: 24, width: '100%', maxWidth: 1000, margin: '0 auto' }}>
      {profile.cover_photo_url && (
        <div
          style={{
            width: '100%',
            height: 200,
            backgroundImage: `url(${profile.cover_photo_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 12,
            marginBottom: 24,
          }}
        />
      )}

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>{profile.display_name || 'No name set'}</h1>
          {profile.tagline && <p style={{ fontSize: '1.1rem', color: '#aaa', marginBottom: 8 }}>{profile.tagline}</p>}
          {profile.country && (
            <p style={{ margin: '4px 0' }}>
              {profile.city && `${profile.city}, `}{profile.country}
            </p>
          )}
          {profile.website && (
            <p style={{ margin: '4px 0' }}>
              <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff' }}>
                {profile.website}
              </a>
            </p>
          )}
          {profile.date_of_birth && (
            <p style={{ margin: '4px 0', color: '#888' }}>
              Born: {new Date(profile.date_of_birth).toLocaleDateString()}
            </p>
          )}
        </div>

        {isOwnProfile && (
          <button
            onClick={() => navigate('/profile/edit')}
            style={{
              padding: '8px 16px',
              background: '#238636',
              border: '1px solid #2ea043',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Edit Profile
          </button>
        )}
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