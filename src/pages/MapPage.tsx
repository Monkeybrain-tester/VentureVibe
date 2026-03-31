import { useState, useEffect } from "react";
import MapComponent from "../components/Map";
import AddMarkerComponent from "../components/AddMarkers";
import AppHeader from "../components/AppHeader";

type MapMarker = {
  lat: number;
  lng: number;
};

function MapPage() {
  const [markers, setMarkers] = useState<MapMarker[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/markers")
      .then((response) => response.json())
      .then((data) => setMarkers(data.markers));
  }, []);

  const handleAddMarker = (marker: MapMarker) => {
    setMarkers((prev) => [...prev, marker]);
  };

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24 }}>
        <h1>My Map</h1>
        <MapComponent markers={markers} />
        <AddMarkerComponent onAddMarker={handleAddMarker} />
      </div>
    </>
  );
}

export default MapPage;