import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

const containerStyle = {
  width: '400px',
  height: '400px'
};

//Set to user's location or default (currently Gainesville)
const center = {
  lat: 29.6516,
  lng: -82.3248
};

const apikey = import.meta.env.VITE_Key

type MapMarker = {
  lat: number;
  lng: number;
};

type MapComponentProps = {
  markers?: MapMarker[];
};

function MapComponent(props: MapComponentProps) {
  const markers = props.markers
  return (
    <APIProvider apiKey={apikey}>
      <Map
        style={containerStyle}
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling='greedy'
        disableDefaultUI
      >
        {markers?.map((marker, index) => (
          <Marker key={index} position={marker} />
        ))}
      </Map>
    </APIProvider>
  );
}

export default MapComponent;