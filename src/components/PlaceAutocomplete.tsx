import React, { useRef, useEffect, useState } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';

interface Props {
  onPlaceSelect: (place: google.maps.places.PlaceResult | null) => void;
}

export const PlaceAutocomplete = ({ onPlaceSelect }: Props) => {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');
  const map = useMap();

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options = {
      fields: ['geometry', 'name', 'formatted_address']
    };

    setPlaceAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!placeAutocomplete || !map) return;

    placeAutocomplete.addListener('place_changed', () => {
      const place = placeAutocomplete.getPlace();
      onPlaceSelect(place);

      if (place.geometry?.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else if (place.geometry?.location) {
        map.setCenter(place.geometry.location);
        map.setZoom(17);
      }
    });
  }, [onPlaceSelect, placeAutocomplete, map]);

  return (
    <div className="autocomplete-container">
      <input 
        ref={inputRef} 
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '300px',
          padding: '10px',
          zIndex: 10
        }}
        placeholder="Search for a place..." 
      />
    </div>
  );
};