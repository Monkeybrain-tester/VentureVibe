/// <reference types="google.maps" />

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

type PolylineProps = {
  path: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
};

function Polyline({
  path,
  strokeColor = '#4285F4',
  strokeOpacity = 1,
  strokeWeight = 4,
}: PolylineProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !window.google || path.length === 0) return;

    if (!polylineRef.current) {
      polylineRef.current = new window.google.maps.Polyline({
        path,
        strokeColor,
        strokeOpacity,
        strokeWeight,
      });
    }

    polylineRef.current.setOptions({
      path,
      strokeColor,
      strokeOpacity,
      strokeWeight,
    });

    polylineRef.current.setMap(map);

    return () => {
      polylineRef.current?.setMap(null);
    };
  }, [map, path, strokeColor, strokeOpacity, strokeWeight]);

  return null;
}

export default Polyline;