import { useState } from "react";
import MapComponent from "../components/Map";
import AddMarkerComponent from "../components/AddMarkers";

type MapMarker = {
    lat: number;
    lng: number;
};

function MapPage() {
    const [markers, setMarkers] = useState([{ lat: 29.6516, lng: -82.3248 }]);

    const handleAddMarker = (marker: MapMarker) => {
        setMarkers((prev) => [...prev, marker]);
    };

    return (
        <>
            <p>My Map</p>
            <MapComponent markers={markers} />
            <AddMarkerComponent onAddMarker={handleAddMarker} />
        </>
    )
}

export default MapPage;