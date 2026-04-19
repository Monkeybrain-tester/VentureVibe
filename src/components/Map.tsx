import { InfoWindow, APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import type { Trip } from '../types';
import Polyline from '../components/Polyline';
import { useState } from 'react';

//Set to user's location or default (currently Gainesville)
const center = {
  lat: 29.6516,
  lng: -82.3248
};

const apikey = import.meta.env.VITE_Key

type MapTripProps = {
  trips?: Trip[];
  center?: {
    lat: number;
    lng: number;
  };
};

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

function getRoutePoints(trip: Trip) {
  if (!trip) return [];
  const sortedLegs = [...trip.legs].sort((a, b) => a.order_index - b.order_index);
  return [
    { lat: trip.start_lat, lng: trip.start_lng },
    ...sortedLegs.map((leg) => ({ lat: leg.lat, lng: leg.lng })),
  ];
};

function MapComponent(props: MapTripProps) {
  const markers = props.trips?.flatMap((trip) => [
    {
      lat: trip.start_lat,
      lng: trip.start_lng,
      type: 'start',
      title: trip.start_location_name,
      description: trip.description || 'Trip starting point',
      tripId: trip.id,
      index: -1,
      leg_start_time: undefined,
      leg_media_urls: undefined,
    },
    ...[...trip.legs]
      .sort((a, b) => a.order_index - b.order_index)
      .map((leg) => ({
        lat: leg.lat,
        lng: leg.lng,
        type: 'leg',
        tripId: trip.id,
        index: leg.order_index,
        title: leg.location_name,
        description: leg.caption || 'No caption provided',
        leg_media_urls: leg.media_urls,
        leg_start_time: leg.start_time || 'Not specified',
      })),
  ]);

  const allRoutePoints = props.trips?.map(getRoutePoints);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '24px 0',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          height: '600px',
          background: '#1f1f1f',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #444',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >

        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            background: '#2a2a2a',
          }}
        >
          <div style={{ color: '#eee', fontSize: '14px', fontWeight: 500 }}>
            Trip Map
          </div>
        </div>

        <div style={{ flex: 1, width: '100%', position: 'relative' }}>
          <APIProvider apiKey={apikey}>
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={props.center || center}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI
              mapId="DEMO_MAP_ID"
            >
              {allRoutePoints?.map((points, index) => (
                <Polyline key={index} path={points} strokeColor="#4285F4" strokeOpacity={1} strokeWeight={4} />
              ))}

              {markers?.map((marker, index) => (
                <Marker
                  key={index} 
                  position={marker} 
                  onClick={() => {
                      if (marker.type === 'start') {
                        setSelectedPoint({
                          type: 'start',
                          lat: marker.lat,
                          lng: marker.lng,
                          title: marker.title,
                          description: marker.description,
                        });
                      } else if (marker.type === 'leg') {
                        setSelectedPoint({
                          type: 'leg',
                          lat: marker.lat,
                          lng: marker.lng,
                          title: marker.title,
                          description: marker.description,
                          start_time: marker.leg_start_time,
                          media_urls: marker.leg_media_urls,
                        });
                      }
                    }
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
                          <p style={{ margin: '0 0 8px 0' }}>
                            <strong>time:</strong> {selectedPoint.start_time && selectedPoint.start_time != 'Not specified' ? new Date(selectedPoint.start_time).toLocaleDateString() : 'Not specified'}
                          </p>

                          <p style={{ margin: '0 0 8px 0' }}>
                            <strong>caption:</strong> {selectedPoint.description || 'No caption provided'}
                          </p>

                          {((selectedPoint.media_urls && selectedPoint.media_urls.length > 0) || (selectedPoint.description != 'No caption provided')) && (
                            <div>
                              <button>See Post</button>
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
      </div>
    </div>
  );
}

export default MapComponent;