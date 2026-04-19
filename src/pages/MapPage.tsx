import { useState, useEffect, useMemo } from "react";
import MapComponent from "../components/Map";
import AppHeader from "../components/AppHeader";
import type { Trip } from "../types";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../lib/api";
import { useSearchParams } from 'react-router-dom';
import { createSignedMediaUrls } from '../lib/mediaUpload';

type MapTrip = Trip & {
  viewer_relation?: 'own' | 'friend' | 'public';
};

function getCenterFromParams(searchParams: URLSearchParams) {
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (lat && lng) {
    return {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    };
  }

  return {
    lat: 29.6516,
    lng: -82.3248,
  };
}

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function MapPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [trips, setTrips] = useState<MapTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedMediaMap, setSignedMediaMap] = useState<Record<string, string>>({});

  const center = useMemo(() => getCenterFromParams(searchParams), [searchParams]);

  useEffect(() => {
    async function load() {
      if (!user) return;

      try {
        const data = await apiFetch<MapTrip[]>(`/map/${user.id}`);
        setTrips(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  useEffect(() => {
    async function signMedia() {
      if (isDummyMode || !trips.length) {
        setSignedMediaMap({});
        return;
      }

      const firstPaths = trips.flatMap((trip) =>
        (trip.legs || [])
          .map((leg) => (leg.media_urls || [])[0])
          .filter(Boolean)
      ) as string[];

      const uniquePaths = Array.from(new Set(firstPaths));
      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error('failed signing map media', err);
      }
    }

    signMedia();
  }, [trips]);

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ marginBottom: 8 }}>Trip Map</h1>
          <p style={{ margin: 0 }}>
            blue = your trips, green = friends, red = public
          </p>
          <p style={{ margin: '8px 0 0 0' }}>
            trips loaded: {trips.length}
          </p>
        </div>

        {loading ? (
          <p>Loading map...</p>
        ) : (
          <div
            style={{
              width: '100%',
              height: 'calc(100vh - 180px)',
              minHeight: 650,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid #444',
            }}
          >
            <MapComponent trips={trips} center={center} signedMediaMap={signedMediaMap} />
          </div>
        )}
      </div>
    </>
  );
}

export default MapPage;