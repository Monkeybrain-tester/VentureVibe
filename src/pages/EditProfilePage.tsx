import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import AppHeader from '../components/AppHeader';
import { uploadAvatar, createSignedAvatarUrl } from '../lib/avatarUpload';

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

type PublicProfileData = {
  id: string;
  username: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  visibility?: string;
  created_at?: string | null;
};

function EditProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [website, setWebsite] = useState('');

  const [avatarPath, setAvatarPath] = useState('');
  const [signedAvatarUrl, setSignedAvatarUrl] = useState('');

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) {
        navigate('/auth');
        return;
      }

      try {
        const [profile, publicProfile] = await Promise.all([
          apiFetch<UserProfileData>(`/user-profiles/${user.id}`),
          apiFetch<PublicProfileData>(`/profiles/${user.id}?viewer_id=${user.id}`),
        ]);

        setDisplayName(profile.display_name || '');
        setTagline(profile.tagline || '');
        setDateOfBirth(profile.date_of_birth || '');
        setCity(profile.city || '');
        setCountry(profile.country || '');
        setCoverPhotoUrl(profile.cover_photo_url || '');
        setWebsite(profile.website || '');
        setAvatarPath(publicProfile.avatar_url || '');
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user?.id, navigate]);

  useEffect(() => {
    async function signAvatar() {
      if (!avatarPath) {
        setSignedAvatarUrl('');
        return;
      }

      try {
        const signed = await createSignedAvatarUrl(avatarPath, 60 * 60);
        setSignedAvatarUrl(signed);
      } catch (err) {
        console.error('Failed to sign avatar url:', err);
      }
    }

    signAvatar();
  }, [avatarPath]);

  async function handleAvatarUpload(file: File) {
    if (!user?.id) return;

    setAvatarUploading(true);
    try {
      const path = await uploadAvatar(file, user.id);

      await apiFetch(`/profiles/${user.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: path }),
      });

      setAvatarPath(path);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user?.id) return;

    setSaving(true);

    try {
      await apiFetch(`/user-profiles/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          tagline: tagline,
          date_of_birth: dateOfBirth || null,
          city: city,
          country: country,
          cover_photo_url: coverPhotoUrl,
          website: website,
        }),
      });

      alert('Profile updated successfully!');
      navigate('/profile');
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const avatarPreview = useMemo(() => {
    if (signedAvatarUrl) {
      return (
        <img
          src={signedAvatarUrl}
          alt="avatar preview"
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '1px solid #555',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1.8rem',
        }}
      >
        {user?.email?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }, [signedAvatarUrl, user?.email]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, width: '100%', maxWidth: 600, margin: '0 auto' }}>
        <h1>Edit Profile</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>Profile Picture</label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {avatarPreview}

              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
                <p style={{ marginTop: 8, opacity: 0.8 }}>
                  {avatarUploading ? 'uploading + compressing...' : 'upload a profile picture'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="displayName" style={{ display: 'block', marginBottom: 4 }}>
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="tagline" style={{ display: 'block', marginBottom: 4 }}>
              Tagline
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short bio or tagline"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="city" style={{ display: 'block', marginBottom: 4 }}>
              City
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="country" style={{ display: 'block', marginBottom: 4 }}>
              Country
            </label>
            <input
              id="country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="dateOfBirth" style={{ display: 'block', marginBottom: 4 }}>
              Date of Birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="website" style={{ display: 'block', marginBottom: 4 }}>
              Website
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label htmlFor="coverPhotoUrl" style={{ display: 'block', marginBottom: 4 }}>
              Cover Photo URL
            </label>
            <input
              id="coverPhotoUrl"
              type="url"
              value={coverPhotoUrl}
              onChange={(e) => setCoverPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1f1f1f',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                background: '#238636',
                border: '1px solid #2ea043',
                borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #444',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default EditProfilePage;