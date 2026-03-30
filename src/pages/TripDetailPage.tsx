import { useEffect, useMemo, useState } from 'react';
import { APIProvider, InfoWindow, Map, Marker } from '@vis.gl/react-google-maps';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip } from '../types';
import AppHeader from '../components/AppHeader';
import Polyline from '../components/Polyline';

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
      lat: number;
      lng: number;
      title: string;
      description?: string;
      start_time?: string;
      media_urls?: string[];
    };

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

function TripDetailPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

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
                    <div style={{ color: '#111', maxWidth: 240 }}>
                      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{selectedPoint.title}</h3>

                      {selectedPoint.type === 'start' ? (
                        <p style={{ margin: 0 }}>{selectedPoint.description}</p>
                      ) : (
                        <>
                          {selectedPoint.start_time && (
                            <p style={{ margin: '0 0 8px 0' }}>
                              <strong>time:</strong> {selectedPoint.start_time}
                            </p>
                          )}

                          {selectedPoint.description && (
                            <p style={{ margin: '0 0 8px 0' }}>{selectedPoint.description}</p>
                          )}

                          {selectedPoint.media_urls && selectedPoint.media_urls.length > 0 && (
                            <div>
                              <strong>media:</strong>
                              <ul style={{ paddingLeft: 18, margin: '8px 0 0 0' }}>
                                {selectedPoint.media_urls.map((url) => (
                                  <li key={url}>
                                    <a href={url} target="_blank" rel="noreferrer">
                                      open
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
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
            <div
              key={leg.id || leg.order_index}
              style={{ border: '1px solid #444', borderRadius: 12, padding: 16 }}
            >
              <h3>{leg.location_name}</h3>
              <p>{leg.start_time}</p>
              <p>{leg.caption}</p>
              {leg.media_urls?.length > 0 && (
                <ul>
                  {leg.media_urls.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default TripDetailPage;