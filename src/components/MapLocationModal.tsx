import { APIProvider, InfoWindow, Map, Marker } from '@vis.gl/react-google-maps';
import { useMemo, useState } from 'react';
import { PlaceAutocomplete } from './PlaceAutocomplete';

type LatLng = {
  lat: number;
  lng: number;
};

type MapLocationModalProps = {
  isOpen: boolean;
  title?: string;
  initialPosition?: LatLng | null;
  onClose: () => void;
  onConfirm: (coords: LatLng) => void;
};

function MapLocationModal({
  isOpen,
  title = 'Pick a location',
  initialPosition,
  onClose,
  onConfirm,
}: MapLocationModalProps) {
  const apiKey = import.meta.env.VITE_Key;
  const [selected, setSelected] = useState<LatLng | null>(initialPosition ?? null);

  const center = useMemo(() => {
    if (selected) return selected;
    if (initialPosition) return initialPosition;
    return { lat: 29.6516, lng: -82.3248 };
  }, [selected, initialPosition]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(1000px, 100%)',
          height: 'min(700px, 90vh)',
          background: '#1f1f1f',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #444',
          display: 'flex',
          flexDirection: 'column',
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
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
            <p style={{ margin: '4px 0 0 0', opacity: 0.85 }}>
              click the map to place the point, then confirm
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose}>
              cancel
            </button>
            <button
              type="button"
              onClick={() => selected && onConfirm(selected)}
              disabled={!selected}
            >
              use location
            </button>
          </div>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid #444' }}>
          <strong>selected:</strong>{' '}
          {selected ? `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}` : 'none'}
        </div>
        
        <div style={{ flex: 1 }}>
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={center}
              defaultZoom={6}
              gestureHandling="greedy"
              disableDefaultUI={false}
              onClick={(event: any) => {
                const latLng = event?.detail?.latLng;
                if (!latLng) return;

                setSelected({
                  lat: latLng.lat,
                  lng: latLng.lng,
                });
              }}
            >
              <PlaceAutocomplete onPlaceSelect={(place) => {
                if (place?.geometry?.location) {
                  setSelected({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                  });
                }
              }} />
              {selected && <Marker position={selected} />}

              {selected && (
                <InfoWindow position={selected} onCloseClick={() => setSelected(null)}>
                  <div style={{ color: '#111' }}>
                    <strong>selected point</strong>
                    <div>{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</div>
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

export default MapLocationModal;