import { APIProvider, InfoWindow, Map, Marker } from '@vis.gl/react-google-maps';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Trip } from '../types';
import Polyline from './Polyline';

const apiKey = import.meta.env.VITE_Key;

type MapTrip = Trip & {
  viewer_relation?: 'own' | 'friend' | 'public';
};

type MapComponentProps = {
  trips?: MapTrip[];
  center?: { lat: number; lng: number };
  signedMediaMap?: Record<string, string>;
};

type SelectedMarker = {
  type: 'start' | 'leg';
  tripId: string;
  tripTitle: string;
  relation: 'own' | 'friend' | 'public';
  title: string;
  lat: number;
  lng: number;
  description?: string;
  start_time?: string;
  thumbnailUrl?: string;
} | null;

function relationColor(relation: 'own' | 'friend' | 'public') {
  if (relation === 'own') return 'blue';
  if (relation === 'friend') return 'green';
  return 'red';
}

function markerIcon(relation: 'own' | 'friend' | 'public') {
  const color = relationColor(relation);
  return `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`;
}

function formatDateOnly(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split('T')[0] || value;
  return date.toLocaleDateString();
}

function MapComponent({
  trips = [],
  center = { lat: 29.6516, lng: -82.3248 },
  signedMediaMap = {},
}: MapComponentProps) {
  const navigate = useNavigate();
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker>(null);

  const markerData = useMemo(() => {
    const allMarkers: NonNullable<SelectedMarker>[] = [];

    for (const trip of trips) {
      const relation = trip.viewer_relation || 'public';

      allMarkers.push({
        type: 'start',
        tripId: trip.id,
        tripTitle: trip.title,
        relation,
        title: `${trip.title} (start)`,
        lat: trip.start_lat,
        lng: trip.start_lng,
        description: trip.start_location_name,
      });

      for (const leg of trip.legs || []) {
        const firstMediaPath = (leg.media_urls || [])[0] || '';
        const thumbnailUrl = firstMediaPath
          ? signedMediaMap[firstMediaPath] || firstMediaPath
          : '';

        allMarkers.push({
          type: 'leg',
          tripId: trip.id,
          tripTitle: trip.title,
          relation,
          title: leg.location_name || trip.title,
          lat: leg.lat,
          lng: leg.lng,
          description: leg.caption,
          start_time: leg.start_time,
          thumbnailUrl,
        });
      }
    }

    return allMarkers;
  }, [trips, signedMediaMap]);

  const routeData = useMemo(() => {
    return trips.map((trip) => ({
      tripId: trip.id,
      relation: trip.viewer_relation || 'public',
      path: [
        { lat: trip.start_lat, lng: trip.start_lng },
        ...(trip.legs || []).map((leg) => ({ lat: leg.lat, lng: leg.lng })),
      ],
    }));
  }, [trips]);

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={center}
        defaultZoom={5}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        {routeData.map((route) => (
          <Polyline
            key={route.tripId}
            path={route.path}
            strokeColor={
              route.relation === 'own'
                ? '#2563eb'
                : route.relation === 'friend'
                ? '#16a34a'
                : '#dc2626'
            }
            strokeOpacity={0.95}
            strokeWeight={4}
          />
        ))}

        {markerData.map((marker, index) => (
          <Marker
            key={`${marker.tripId}-${marker.type}-${index}`}
            position={{ lat: marker.lat, lng: marker.lng }}
            icon={markerIcon(marker.relation)}
            onClick={() => setSelectedMarker(marker)}
          />
        ))}

        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div
              onClick={() => navigate(`/trips/${selectedMarker.tripId}`)}
              style={{
                color: '#111',
                maxWidth: 230,
                cursor: 'pointer',
                display: 'grid',
                gap: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>{selectedMarker.title}</h3>

              {selectedMarker.start_time && (
                <p style={{ margin: 0 }}>
                  time: {formatDateOnly(selectedMarker.start_time)}
                </p>
              )}

              {selectedMarker.description && (
                <p style={{ margin: 0 }}>{selectedMarker.description}</p>
              )}

              {selectedMarker.thumbnailUrl && (
                <img
                  src={selectedMarker.thumbnailUrl}
                  alt="leg preview"
                  style={{
                    width: '100%',
                    maxHeight: 120,
                    objectFit: 'cover',
                    borderRadius: 8,
                  }}
                />
              )}

              <div style={{ fontWeight: 600 }}>open trip</div>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}

export default MapComponent;