import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { apiFetch } from '../lib/api';
import type { Trip } from '../types';
import { createSignedMediaUrls } from '../lib/mediaUpload';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}

function formatDateOnly(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split('T')[0] || value;
  return date.toLocaleDateString();
}

function LegDetailPage() {
  const { tripId, legId } = useParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [signedMediaMap, setSignedMediaMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadTrip() {
      if (!tripId) return;
      try {
        const data = await apiFetch<Trip>(`/trips/${tripId}`);
        setTrip(data);
      } catch (err) {
        console.error(err);
      }
    }

    loadTrip();
  }, [tripId]);

  const leg = useMemo(() => {
    if (!trip || !legId) return null;
    return trip.legs.find((item) => item.id === legId) || null;
  }, [trip, legId]);

  useEffect(() => {
    async function signMedia() {
      if (!leg || isDummyMode) return;

      const uniquePaths = Array.from(new Set(leg.media_urls || []));
      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error('failed signing leg media', err);
      }
    }

    signMedia();
  }, [leg]);

  function resolveMediaUrl(pathOrUrl: string) {
    if (isDummyMode) return pathOrUrl;
    return signedMediaMap[pathOrUrl] || '';
  }

  if (!trip) return <div style={{ padding: 24 }}>Loading trip...</div>;
  if (!leg) return <div style={{ padding: 24 }}>Leg not found.</div>;

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <Link to={`/trips/${trip.id}`}>← back to trip</Link>
        </div>

        <h1>{leg.location_name}</h1>
        <p><strong>trip:</strong> {trip.title}</p>
        <p><strong>date:</strong> {formatDateOnly(leg.start_time)}</p>
        {leg.caption && <p>{leg.caption}</p>}

        {(leg.media_urls || []).length > 0 ? (
          <div
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              marginTop: 20,
            }}
          >
            {leg.media_urls.map((path) => {
              const signedUrl = resolveMediaUrl(path);
              if (!signedUrl) return null;

              if (isImage(signedUrl)) {
                return (
                  <img
                    key={path}
                    src={signedUrl}
                    alt={leg.location_name}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      maxHeight: 380,
                      objectFit: 'cover',
                    }}
                  />
                );
              }

              if (isVideo(signedUrl)) {
                return (
                  <video
                    key={path}
                    src={signedUrl}
                    controls
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      maxHeight: 380,
                    }}
                  />
                );
              }

              return (
                <a key={path} href={signedUrl} target="_blank" rel="noreferrer">
                  open media
                </a>
              );
            })}
          </div>
        ) : (
          <p>No media for this leg yet.</p>
        )}
      </div>
    </>
  );
}

export default LegDetailPage;