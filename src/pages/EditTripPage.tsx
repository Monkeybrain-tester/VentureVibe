import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { Trip, TripLeg, TripStatus, Visibility } from '../types';
import AppHeader from '../components/AppHeader';
import MapLocationModal from '../components/MapLocationModal';

const isDummyMode = import.meta.env.VITE_APP_MODE === 'dummy';

type PickerTarget =
  | { type: 'start' }
  | { type: 'leg'; index: number }
  | null;

function blankLeg(orderIndex: number): TripLeg {
  return {
    order_index: orderIndex,
    location_name: '',
    lat: 0,
    lng: 0,
    start_time: '',
    caption: '',
    media_urls: [],
  };
}

function EditTripPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loadedTrip, setLoadedTrip] = useState<Trip | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocationName, setStartLocationName] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [status, setStatus] = useState<TripStatus>('unstarted');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [legs, setLegs] = useState<TripLeg[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);

  useEffect(() => {
    async function loadTrip() {
      if (!tripId) return;

      try {
        const data = await apiFetch<Trip>(`/trips/${tripId}`);
        setLoadedTrip(data);

        setTitle(data.title);
        setDescription(data.description || '');
        setStartLocationName(data.start_location_name);
        setStartLat(String(data.start_lat));
        setStartLng(String(data.start_lng));
        setStatus(data.status);
        setVisibility(data.visibility);
        setLegs([...data.legs].sort((a, b) => a.order_index - b.order_index));
      } catch (err) {
        console.error(err);
      }
    }

    loadTrip();
  }, [tripId]);

  const isOwner = useMemo(() => {
    if (!loadedTrip) return false;
    return isDummyMode || user?.id === loadedTrip.user_id;
  }, [loadedTrip, user?.id]);

  function reindex(nextLegs: TripLeg[]) {
    return nextLegs.map((leg, index) => ({ ...leg, order_index: index }));
  }

  function updateLeg(index: number, field: keyof TripLeg, value: any) {
    setLegs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function insertLegAt(index: number) {
    setLegs((prev) => reindex([...prev.slice(0, index), blankLeg(index), ...prev.slice(index)]));
  }

  function addLegToEnd() {
    setLegs((prev) => [...prev, blankLeg(prev.length)]);
  }

  function removeLeg(index: number) {
    setLegs((prev) => reindex(prev.filter((_, i) => i !== index)));
  }

  const getInitialPickerPosition = () => {
    if (!pickerTarget) return null;

    if (pickerTarget.type === 'start') {
      const lat = Number(startLat);
      const lng = Number(startLng);
      return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
    }

    const leg = legs[pickerTarget.index];
    const lat = Number(leg?.lat);
    const lng = Number(leg?.lng);
    return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
  };

  function handleConfirmPick(coords: { lat: number; lng: number }) {
    if (!pickerTarget) return;

    if (pickerTarget.type === 'start') {
      setStartLat(String(coords.lat));
      setStartLng(String(coords.lng));
    } else {
      updateLeg(pickerTarget.index, 'lat', coords.lat);
      updateLeg(pickerTarget.index, 'lng', coords.lng);
    }

    setPickerTarget(null);
  }

  async function saveTrip() {
    if (!loadedTrip || !tripId) return;

    const payload = {
      user_id: loadedTrip.user_id,
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
      await apiFetch(`/trips/${tripId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      navigate(`/trips/${tripId}`);
    } catch (err) {
      console.error(err);
      alert('failed to save trip');
    }
  }

  if (!loadedTrip) return <div style={{ padding: 24 }}>Loading trip...</div>;
  if (!isOwner) return <div style={{ padding: 24 }}>You cannot edit this trip.</div>;

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 950, margin: '0 auto', width: '100%' }}>
        <h1>Edit Trip</h1>

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
            <button type="button" onClick={() => setPickerTarget({ type: 'start' })}>
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

        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Legs</h2>
          <button type="button" onClick={addLegToEnd}>add leg to end</button>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {legs.map((leg, index) => (
            <div key={leg.id || index} style={{ border: '1px solid #444', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Leg {index + 1}</h3>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => insertLegAt(index)}>insert before</button>
                  <button type="button" onClick={() => insertLegAt(index + 1)}>insert after</button>
                  {legs.length > 1 && <button type="button" onClick={() => removeLeg(index)}>remove</button>}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
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
                <button type="button" onClick={() => setPickerTarget({ type: 'leg', index })}>
                  pick leg {index + 1} on map
                </button>

                <input
                  type="datetime-local"
                  value={leg.start_time}
                  onChange={(e) => updateLeg(index, 'start_time', e.target.value)}
                />
                <textarea
                  placeholder="caption"
                  value={leg.caption || ''}
                  onChange={(e) => updateLeg(index, 'caption', e.target.value)}
                />
                <input
                  placeholder="media urls, comma separated"
                  value={(leg.media_urls || []).join(',')}
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

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button type="button" onClick={saveTrip}>save trip</button>
          <button type="button" onClick={() => navigate(`/trips/${tripId}`)}>cancel</button>
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

export default EditTripPage;