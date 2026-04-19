import { useEffect, useMemo, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker } from '@vis.gl/react-google-maps';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip } from '../types';
import AppHeader from '../components/AppHeader';
import Polyline from '../components/Polyline';
import { createSignedMediaUrls } from '../lib/mediaUpload';

type SelectedPoint =
  | {
      type: 'start';
      lat: number;
      lng: number;
      title: string;
      description?: string;
    }
  | {
      type: 'leg';
      legId?: string;
      tripId: string;
      lat: number;
      lng: number;
      title: string;
      description?: string;
      start_time?: string;
      media_urls?: string[];
    };

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

function TripDetailPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
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

  useEffect(() => {
    async function signMedia() {
      if (!trip || isDummyMode) return;

      const allPaths = trip.legs.flatMap((leg) => leg.media_urls || []);
      const uniquePaths = Array.from(new Set(allPaths));

      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error('failed signing media urls', err);
      }
    }

    signMedia();
  }, [trip]);

  const apiKey = import.meta.env.VITE_Key;

  const sortedLegs = useMemo(() => {
    if (!trip) return [];
    return [...trip.legs].sort((a, b) => a.order_index - b.order_index);
  }, [trip]);

  const routePoints = useMemo(() => {
    if (!trip) return [];
    return [
      { lat: trip.start_lat, lng: trip.start_lng },
      ...sortedLegs.map((leg) => ({ lat: leg.lat, lng: leg.lng })),
    ];
  }, [trip, sortedLegs]);

  const mapCenter = useMemo(() => {
    if (!routePoints.length) return { lat: 29.6516, lng: -82.3248 };

    const avgLat = routePoints.reduce((sum, p) => sum + p.lat, 0) / routePoints.length;
    const avgLng = routePoints.reduce((sum, p) => sum + p.lng, 0) / routePoints.length;
    return { lat: avgLat, lng: avgLng };
  }, [routePoints]);

  function resolveMediaUrl(pathOrUrl: string) {
    if (isDummyMode) return pathOrUrl;
    return signedMediaMap[pathOrUrl] || '';
  }

  if (!trip) return <div style={{ padding: 24 }}>Loading trip...</div>;

  const isOwner = isDummyMode || user?.id === trip.user_id;

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1>{trip.title}</h1>
            <p>{trip.description}</p>
            <p>status: {trip.status}</p>
            <p>visibility: {trip.visibility}</p>
            <p>start: {trip.start_location_name}</p>
          </div>

          {isOwner && (
            <div>
              <button onClick={() => navigate(`/trips/${trip.id}/edit`)}>edit trip</button>
            </div>
          )}
        </div>

        {apiKey && routePoints.length > 0 ? (
          <div style={{ height: 500, width: '100%', margin: '24px 0', borderRadius: 12, overflow: 'hidden' }}>
            <APIProvider apiKey={apiKey}>
              <Map
                defaultCenter={mapCenter}
                defaultZoom={6}
                gestureHandling="greedy"
                disableDefaultUI={false}
              >
                <Polyline path={routePoints} strokeColor="#4285F4" strokeOpacity={1} strokeWeight={4} />

                <Marker
                  position={{ lat: trip.start_lat, lng: trip.start_lng }}
                  onClick={() =>
                    setSelectedPoint({
                      type: 'start',
                      lat: trip.start_lat,
                      lng: trip.start_lng,
                      title: trip.start_location_name,
                      description: 'trip starting point',
                    })
                  }
                />

                {sortedLegs.map((leg) => (
                  <Marker
                    key={leg.id || leg.order_index}
                    position={{ lat: leg.lat, lng: leg.lng }}
                    onClick={() =>
                      setSelectedPoint({
                        type: 'leg',
                        legId: leg.id,
                        tripId: trip.id,
                        lat: leg.lat,
                        lng: leg.lng,
                        title: leg.location_name,
                        description: leg.caption,
                        start_time: leg.start_time,
                        media_urls: leg.media_urls,
                      })
                    }
                  />
                ))}

                {selectedPoint && (
                  <InfoWindow
                    position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div style={{ color: '#111', maxWidth: 260 }}>
                      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{selectedPoint.title}</h3>

                      {selectedPoint.type === 'start' ? (
                        <p style={{ margin: 0 }}>{selectedPoint.description}</p>
                      ) : (
                        <>
                          {selectedPoint.start_time && (
                            <p style={{ margin: '0 0 8px 0' }}>
                              <strong>time:</strong> {formatDateOnly(selectedPoint.start_time)}
                            </p>
                          )}

                          {selectedPoint.description && (
                            <p style={{ margin: '0 0 8px 0' }}>{selectedPoint.description}</p>
                          )}

                          {selectedPoint.media_urls && selectedPoint.media_urls.length > 0 && (
                            <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                              {selectedPoint.media_urls.slice(0, 1).map((path) => {
                                const signedUrl = resolveMediaUrl(path);
                                if (!signedUrl) return null;

                                return isImage(signedUrl) ? (
                                  <img
                                    key={path}
                                    src={signedUrl}
                                    alt="leg media"
                                    style={{
                                      width: '100%',
                                      borderRadius: 8,
                                      maxHeight: 180,
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : isVideo(signedUrl) ? (
                                  <video
                                    key={path}
                                    src={signedUrl}
                                    controls
                                    style={{
                                      width: '100%',
                                      borderRadius: 8,
                                      maxHeight: 180,
                                    }}
                                  />
                                ) : null;
                              })}
                            </div>
                          )}

                          {selectedPoint.legId && (
                            <Link to={`/trips/${selectedPoint.tripId}/legs/${selectedPoint.legId}`}>
                              open leg page
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </Map>
            </APIProvider>
          </div>
        ) : (
          <p>Map unavailable. Check your Google Maps API key.</p>
        )}

        <h2>Legs</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {sortedLegs.map((leg) => (
            <Link
              key={leg.id || leg.order_index}
              to={`/trips/${trip.id}/legs/${leg.id}`}
              style={{
                border: '1px solid #444',
                borderRadius: 12,
                padding: 16,
                textDecoration: 'none',
                display: 'block',
              }}
            >
              <h3>{leg.location_name}</h3>
              <p>{formatDateOnly(leg.start_time)}</p>
              <p>{leg.caption}</p>

              {(leg.media_urls || []).length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    marginTop: 12,
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
                          alt="trip media"
                          style={{
                            width: '100%',
                            borderRadius: 12,
                            maxHeight: 260,
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
                            maxHeight: 260,
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
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export default TripDetailPage;