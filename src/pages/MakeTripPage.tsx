import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { TripLeg, TripStatus, Visibility } from '../types';
import AppHeader from '../components/AppHeader';
import MapLocationModal from '../components/MapLocationModal';

type PickerTarget =
  | { type: 'start' }
  | { type: 'leg'; index: number }
  | null;

function MakeTripPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocationName, setStartLocationName] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [status, setStatus] = useState<TripStatus>('unstarted');
  const [visibility, setVisibility] = useState<Visibility>('public');

  const [legs, setLegs] = useState<TripLeg[]>([
    {
      order_index: 0,
      location_name: '',
      lat: 0,
      lng: 0,
      start_time: '',
      caption: '',
      media_urls: [],
    },
  ]);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  const addLeg = () => {
    setLegs([
      ...legs,
      {
        order_index: legs.length,
        location_name: '',
        lat: 0,
        lng: 0,
        start_time: '',
        caption: '',
        media_urls: [],
      },
    ]);
  };

  const updateLeg = (index: number, field: keyof TripLeg, value: any) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    setLegs(updated);
  };

  const openStartPicker = () => setPickerTarget({ type: 'start' });
  const openLegPicker = (index: number) => setPickerTarget({ type: 'leg', index });

  const getInitialPickerPosition = () => {
    if (!pickerTarget) return null;

    if (pickerTarget.type === 'start') {
      const lat = Number(startLat);
      const lng = Number(startLng);
      return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
    }

    const leg = legs[pickerTarget.index];
    const lat = Number(leg.lat);
    const lng = Number(leg.lng);
    return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
  };

  const handleConfirmPick = (coords: { lat: number; lng: number }) => {
    if (!pickerTarget) return;

    if (pickerTarget.type === 'start') {
      setStartLat(String(coords.lat));
      setStartLng(String(coords.lng));
    } else {
      setLegs(prevLegs => {
        const updated = [...prevLegs];
        updated[pickerTarget.index] = {
          ...updated[pickerTarget.index],
          lat: coords.lat,
          lng: coords.lng,
        };
        return updated;
      });
    }

    setPickerTarget(null);
  };

  const submitTrip = async () => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      title,
      description,
      start_location_name: startLocationName,
      start_lat: Number(startLat),
      start_lng: Number(startLng),
      status,
      visibility,
      legs: legs.map((leg, i) => ({
        ...leg,
        order_index: i,
        lat: Number(leg.lat),
        lng: Number(leg.lng),
      })),
    };

    try {
      const created = await apiFetch<{ id: string }>('/trips', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      navigate(`/trips/${created.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create trip');
    }
  };

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <h1>Make Trip</h1>

        <div style={{ display: 'grid', gap: 12 }}>
          <input placeholder="trip title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea placeholder="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input
            placeholder="start location name"
            value={startLocationName}
            onChange={(e) => setStartLocationName(e.target.value)}
          />

          <div style={{ display: 'grid', gap: 8 }}>
            <input placeholder="start latitude" value={startLat} onChange={(e) => setStartLat(e.target.value)} />
            <input placeholder="start longitude" value={startLng} onChange={(e) => setStartLng(e.target.value)} />
            <button type="button" onClick={openStartPicker}>
              pick start on map
            </button>
          </div>

          <label>
            status:
            <select value={status} onChange={(e) => setStatus(e.target.value as TripStatus)}>
              <option value="unstarted">unstarted</option>
              <option value="traveling">traveling</option>
              <option value="closed">closed</option>
            </select>
          </label>

          <label>
            visibility:
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              <option value="public">public</option>
              <option value="friends">friends</option>
              <option value="private">private</option>
            </select>
          </label>
        </div>

        <h2 style={{ marginTop: 32 }}>Legs</h2>
        <div style={{ display: 'grid', gap: 20 }}>
          {legs.map((leg, index) => (
            <div key={index} style={{ border: '1px solid #444', borderRadius: 12, padding: 16 }}>
              <h3>Leg {index + 1}</h3>

              <div style={{ display: 'grid', gap: 10 }}>
                <input
                  placeholder="location name"
                  value={leg.location_name}
                  onChange={(e) => updateLeg(index, 'location_name', e.target.value)}
                />
                <input
                  placeholder="latitude"
                  value={String(leg.lat)}
                  onChange={(e) => updateLeg(index, 'lat', e.target.value)}
                />
                <input
                  placeholder="longitude"
                  value={String(leg.lng)}
                  onChange={(e) => updateLeg(index, 'lng', e.target.value)}
                />
                <button type="button" onClick={() => openLegPicker(index)}>
                  pick leg {index + 1} on map
                </button>

                <input
                  type="datetime-local"
                  value={leg.start_time}
                  onChange={(e) => updateLeg(index, 'start_time', e.target.value)}
                />
                <textarea
                  placeholder="caption"
                  value={leg.caption}
                  onChange={(e) => updateLeg(index, 'caption', e.target.value)}
                />
                <input
                  placeholder="media urls, comma separated for now"
                  value={leg.media_urls.join(',')}
                  onChange={(e) =>
                    updateLeg(
                      index,
                      'media_urls',
                      e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button type="button" onClick={addLeg}>add leg</button>
          <button type="button" onClick={submitTrip}>create trip</button>
        </div>
      </div>

      <MapLocationModal
        isOpen={pickerTarget !== null}
        title={
          pickerTarget?.type === 'start'
            ? 'Pick trip start location'
            : pickerTarget
            ? `Pick location for leg ${pickerTarget.index + 1}`
            : 'Pick location'
        }
        initialPosition={getInitialPickerPosition()}
        onClose={() => setPickerTarget(null)}
        onConfirm={handleConfirmPick}
      />
    </>
  );
}

export default MakeTripPage;