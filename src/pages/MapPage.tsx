import { useState, useEffect } from "react";
import MapComponent from "../components/Map";
import AddMarkerComponent from "../components/AddMarkers";
import { useAuth } from "../AuthContext";

type MapMarker = {
    lat: number;
    lng: number;
};

function MapPage() {
    const [markers, setMarkers] = useState<MapMarker[]>([]);
    const { signOut } = useAuth();

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
            <button onClick={signOut} style={{ position: 'fixed', top: '1rem', right: '1rem' }}>Logout</button>
            <p>My Map</p>
            <MapComponent markers={markers} />
            <AddMarkerComponent onAddMarker={handleAddMarker} />
        </>
    )
}

export default MapPage;