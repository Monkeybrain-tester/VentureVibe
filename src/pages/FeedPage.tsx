import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip } from '../types';
import TripCard from '../components/TripCard';
import { createSignedMediaUrls } from '../lib/mediaUpload';
import { createSignedAvatarUrl, isDirectUrl } from '../lib/avatarUpload';

type FeedTrip = Trip & {
  author_id?: string;
  author_username?: string;
  author_avatar_url?: string;
};

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function FeedPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<FeedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedMediaMap, setSignedMediaMap] = useState<Record<string, string>>({});
  const [signedAvatarMap, setSignedAvatarMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadFeed() {
      if (!user) return;

      try {
        const data = await apiFetch<FeedTrip[]>(`/feed/${user.id}`);
        console.log(
          'FEED raw data',
          data.map((trip) => ({
            title: trip.title,
            author: trip.author_username,
            avatar: trip.author_avatar_url,
            authorId: trip.author_id,
          }))
        );
        setTrips(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadFeed();
  }, [user]);

  useEffect(() => {
    async function signMedia() {
      if (isDummyMode || !trips.length) {
        setSignedMediaMap({});
        return;
      }

      const allPaths = trips.flatMap((trip) =>
        (trip.legs || []).flatMap((leg) => leg.media_urls || [])
      );

      const uniquePaths = Array.from(new Set(allPaths.filter(Boolean)));
      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error('failed signing feed media', err);
      }
    }

    signMedia();
  }, [trips]);

  useEffect(() => {
    async function signAvatars() {
      if (isDummyMode || !trips.length) {
        setSignedAvatarMap({});
        return;
      }

      const avatarPaths = Array.from(
        new Set(
          trips
            .map((trip) => trip.author_avatar_url)
            .filter((value): value is string => Boolean(value && value.trim()))
        )
      );

      if (!avatarPaths.length) {
        setSignedAvatarMap({});
        return;
      }

      const result: Record<string, string> = {};

      for (const path of avatarPaths) {
        try {
          let resolved = '';

          if (isDirectUrl(path)) {
            resolved = path;
          } else {
            resolved = await createSignedAvatarUrl(path, 60 * 60);
          }

          result[path] = resolved;
        } catch (err) {
          console.error(`failed signing avatar for ${path}`, err);
          result[path] = '';
        }
      }

      console.log('FEED signedAvatarMap', result);
      setSignedAvatarMap(result);
    }

    signAvatars();
  }, [trips]);

  const tripCards = useMemo(() => {
    return trips.map((trip) => {
      const firstMediaPath =
        trip.legs?.flatMap((leg) => leg.media_urls || []).find(Boolean) || '';

      const thumbnailUrl = isDummyMode
        ? firstMediaPath
        : signedMediaMap[firstMediaPath] || '';

      const avatarUrl = isDummyMode
        ? trip.author_avatar_url || ''
        : trip.author_avatar_url
        ? signedAvatarMap[trip.author_avatar_url] || ''
        : '';

      return (
        <TripCard
          key={trip.id}
          trip={trip}
          authorId={trip.author_id || trip.user_id}
          authorName={trip.author_username}
          authorAvatarUrl={avatarUrl}
          thumbnailUrl={thumbnailUrl}
        />
      );
    });
  }, [trips, signedMediaMap, signedAvatarMap]);

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <h1>Recent Trips</h1>
        <p>the 10 most recent public trips and visible trips from your friends</p>

        {loading ? (
          <p>Loading feed...</p>
        ) : trips.length === 0 ? (
          <p>No visible trips yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>{tripCards}</div>
        )}
      </div>
    </>
  );
}

export default FeedPage;