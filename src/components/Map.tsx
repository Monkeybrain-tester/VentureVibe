import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '400px',
  height: '400px'
};

//Set to user's location or default (currently Gainesville)
const center = {
  lat: 29.6516,
  lng: -82.3248
};

function MapComponent() {
  return (
    <LoadScript googleMapsApiKey="AIzaSyCq1qxujv1Za96KIc4srGxQlWBTu6tY8oU">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
      >
        <Marker position={center} />
      </GoogleMap>
    </LoadScript>
  );
}

export default MapComponent;