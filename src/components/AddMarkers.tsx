import { useState } from "react"

function AddMarkerComponent({ onAddMarker }: { onAddMarker: (marker: { lat: number, lng: number }) => void }) {
    const [long, setLong] = useState('')
    const [lat, setLat] = useState('')

    const longChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLong(event.target.value);
    };

    const latChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLat(event.target.value);
    };

    function addMarker() {
        let latMark: number;
        let longMark: number;
        latMark = Number(lat)
        longMark = Number(long)

        if (isNaN(latMark) || isNaN(longMark)) {
            console.log("Not a number")
            return;
        }

        const location = {
            lat: latMark,
            lng: longMark
        }
        setLat('')
        setLong('')
        onAddMarker(location)
    }

    return (
        <div>
            <p>Long:</p>
            <input type="text" value={long} onChange={longChange} />
            <p>Lat:</p>
            <input type="text" value={lat} onChange={latChange} />
            <button onClick={addMarker}>Add Marker</button>
        </div>
    )
}

export default AddMarkerComponent