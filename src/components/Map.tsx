import { AdvancedMarker, APIProvider, Map, Marker, Pin } from '@vis.gl/react-google-maps';
import type { Trip } from '../types';
import Polyline from '../components/Polyline';
import type { TripLeg } from '../types';

//Set to user's location or default (currently Gainesville)
const center = {
  lat: 29.6516,
  lng: -82.3248
};

const apikey = import.meta.env.VITE_Key

type MapTripProps = {
  trips?: Trip[];
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
    { lat: trip.start_lat, lng: trip.start_lng },
    ...trip.legs.map((leg) => ({ lat: leg.lat, lng: leg.lng }))
  ]);

  const allRoutePoints = props.trips?.map(getRoutePoints);

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
              defaultCenter={center}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI
              mapId="DEMO_MAP_ID"
            >
              {allRoutePoints?.map((points, index) => (
                <Polyline key={index} path={points} strokeColor="#4285F4" strokeOpacity={1} strokeWeight={4} />
              ))}

              {markers?.map((marker, index) => (
                <AdvancedMarker key={index} position={marker} >
                  <Pin
                    background={'#0f9d58'}
                    borderColor={'#006425'}
                    glyphColor={'#60d98f'}
                  />
                </AdvancedMarker>

              ))}
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}

export default MapComponent;