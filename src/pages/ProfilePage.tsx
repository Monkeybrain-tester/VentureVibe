import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip, UserProfile } from '../types';
import AppHeader from '../components/AppHeader';
import TripCard from '../components/TripCard';
import { createSignedMediaUrls } from '../lib/mediaUpload';
import { createSignedAvatarUrl } from '../lib/avatarUpload';
import CommentsSection from '../components/CommentsSection';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

type ExtendedUserProfile = {
  user_id: string;
  display_name: string;
  tagline: string;
  date_of_birth: string | null;
  city: string;
  country: string;
  cover_photo_url: string;
  website: string;
};

type AdminProfile = UserProfile & {
  is_admin?: boolean;
  is_suspended?: boolean;
};

const adminButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: '#facc15',
  color: '#1a1a1a',
  border: '1px solid #eab308',
  borderRadius: 8,
  fontWeight: 700,
  cursor: 'pointer',
};

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams();

  const targetUserId = userId || (isDummyMode ? 'test-user-1' : user?.id);

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [extendedProfile, setExtendedProfile] = useState<ExtendedUserProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedMediaMap, setSignedMediaMap] = useState<Record<string, string>>({});
  const [signedAvatarUrl, setSignedAvatarUrl] = useState('');
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  const isOwnProfile = isDummyMode || user?.id === targetUserId;
  const displayName =
    extendedProfile?.display_name?.trim() || profile?.username || 'Unknown User';

  async function loadProfilePage() {
    if (!targetUserId) {
      setError('No user id available');
      setLoading(false);
      return;
    }

    try {
      const viewerId = isDummyMode ? 'test-user-1' : user?.id;

      const [profileData, tripsData] = await Promise.all([
        apiFetch<AdminProfile>(
          `/profiles/${targetUserId}?viewer_id=${viewerId ?? ''}`
        ),
        apiFetch<Trip[]>(
          `/profiles/${targetUserId}/trips?viewer_id=${viewerId ?? ''}`
        ),
      ]);

      setProfile(profileData);
      setTrips(tripsData);

      try {
        const extraData = await apiFetch<ExtendedUserProfile>(
          `/user-profiles/${targetUserId}`
        );
        setExtendedProfile(extraData);
      } catch (extraErr) {
        console.error('failed loading extended user profile', extraErr);
        setExtendedProfile(null);
      }
    } catch (err: any) {
      console.error('PROFILE LOAD ERROR:', err);
      const message = err?.message || err?.detail || JSON.stringify(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfilePage();
  }, [targetUserId, user?.id]);

  useEffect(() => {
    async function loadAdminState() {
      if (!user?.id) {
        setViewerIsAdmin(false);
        return;
      }

      try {
        const data = await apiFetch<{ is_admin: boolean }>(`/admin/me/${user.id}`);
        setViewerIsAdmin(Boolean(data.is_admin));
      } catch (err) {
        console.error(err);
        setViewerIsAdmin(false);
      }
    }

    loadAdminState();
  }, [user?.id]);

  useEffect(() => {
    async function signMedia() {
      if (isDummyMode || !trips.length) {
        setSignedMediaMap({});
        return;
      }

      const allPaths = trips.flatMap((trip) =>
        (trip.legs || []).flatMap((leg) => leg.media_urls || [])
      );

      const uniquePaths = Array.from(new Set(allPaths));
      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error('failed signing profile trip media', err);
      }
    }

    signMedia();
  }, [trips]);

  useEffect(() => {
    async function signAvatar() {
      if (!profile?.avatar_url) {
        setSignedAvatarUrl('');
        return;
      }

      if (isDummyMode) {
        setSignedAvatarUrl(profile.avatar_url);
        return;
      }

      try {
        const signed = await createSignedAvatarUrl(profile.avatar_url, 60 * 60);
        setSignedAvatarUrl(signed);
      } catch (err) {
        console.error('failed signing profile avatar', err);
      }
    }

    signAvatar();
  }, [profile?.avatar_url]);

  async function toggleSuspended() {
    if (!user?.id || !profile || isOwnProfile) return;

    const nextSuspended = !profile.is_suspended;
    const confirmed = window.confirm(
      nextSuspended
        ? 'Suspend this user?'
        : 'Unsuspend this user?'
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/admin/users/${profile.id}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({
          actor_id: user.id,
          is_suspended: nextSuspended,
        }),
      });
      await loadProfilePage();
    } catch (err) {
      console.error(err);
      alert('failed to update user suspension');
    }
  }

  async function toggleTripLike(tripId: string, liked: boolean) {
    if (!user?.id) return;

    try {
      await apiFetch(`/trips/${tripId}/${liked ? 'unlike' : 'like'}`, {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id }),
      });
      await loadProfilePage();
    } catch (err) {
      console.error(err);
      alert('failed to update trip like');
    }
  }

  const tripCards = useMemo(() => {
    return trips.map((trip) => {
      const firstMediaPath =
        trip.legs?.flatMap((leg) => leg.media_urls || []).find(Boolean) || '';

      const thumbnailUrl = isDummyMode
        ? firstMediaPath
        : signedMediaMap[firstMediaPath] || '';

      return (
        <TripCard
          key={trip.id}
          trip={trip}
          authorId={profile?.id}
          authorName={displayName}
          authorAvatarUrl={signedAvatarUrl}
          thumbnailUrl={thumbnailUrl}
          onToggleLike={toggleTripLike}
        />
      );
    });
  }, [trips, profile, displayName, signedMediaMap, signedAvatarUrl]);

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

  const avatarNode = signedAvatarUrl ? (
    <img
      src={signedAvatarUrl}
      alt={displayName}
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  ) : (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: '1px solid #555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '1.4rem',
        flexShrink: 0,
      }}
    >
      {displayName?.[0]?.toUpperCase() || '?'}
    </div>
  );

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, width: '100%', maxWidth: 1000, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isOwnProfile ? (
              avatarNode
            ) : (
              <Link to={`/profile/${profile.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {avatarNode}
              </Link>
            )}

            <div>
              <h1 style={{ margin: 0 }}>{displayName}</h1>

              {extendedProfile?.tagline ? (
                <p style={{ margin: '8px 0 0 0' }}>{extendedProfile.tagline}</p>
              ) : profile.bio ? (
                <p style={{ margin: '8px 0 0 0' }}>{profile.bio}</p>
              ) : null}

              {profile.is_suspended && (
                <p style={{ margin: '8px 0 0 0', color: '#facc15', fontWeight: 700 }}>
                  suspended user
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isOwnProfile && (
              <>
                <button type="button" onClick={() => navigate('/profile/edit')}>
                  edit profile
                </button>
                <button type="button" onClick={() => navigate('/likes')}>
                  likes
                </button>
              </>
            )}

            {viewerIsAdmin && !isOwnProfile && (
              <button type="button" style={adminButtonStyle} onClick={toggleSuspended}>
                {profile.is_suspended ? 'unsuspend user' : 'suspend user'}
              </button>
            )}
          </div>
        </div>

        <h2>Trips</h2>
        {trips.length === 0 ? (
          <p>No trips yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>{tripCards}</div>
        )}

        {profile.id && (
          <CommentsSection
            mode="profile"
            targetId={profile.id}
            title="Comments"
            viewerIsAdmin={viewerIsAdmin}
          />
        )}
      </div>
    </>
  );
}

export default ProfilePage;