import { useState, useEffect } from "react";
import MapComponent from "../components/Map";
import AddMarkerComponent from "../components/AddMarkers";

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
            <p>My Map</p>
            <MapComponent markers={markers} />
            <AddMarkerComponent onAddMarker={handleAddMarker} />
        </>
    )
}

export default MapPage;