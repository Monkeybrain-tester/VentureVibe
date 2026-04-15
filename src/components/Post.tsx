import type { Trip, TripLeg } from '../types';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


type PostProps = {
    tripLeg: TripLeg;
    title: string;
    owner?: string;
    content: string;
};

export default function PostComponent(props: PostProps) {
  const [index, setIndex] = useState(0);

  const nextImage = () => setIndex((index + 1) % props.tripLeg.media_urls.length);
  const prevImage = () => setIndex((index - 1 + props.tripLeg.media_urls.length) % props.tripLeg.media_urls.length);

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 16, width: '100%', borderRadius: 8, backgroundColor: '#000' }}>
      <div>
        <h4 style={{ margin: '4px 0' }}>{props.owner || 'Unknown traveler'}</h4>
      </div>
      <h2>{props.tripLeg.location_name || 'Not locations'}</h2>
      <h3>{props.title}</h3>
      <p>Lat: {props.tripLeg.lat?.toPrecision(4)}°, Long: {props.tripLeg.lng?.toPrecision(4)}°</p>
      <p>Date: {props.tripLeg.start_time ? new Date(props.tripLeg.start_time).toLocaleDateString() : 'Not specified'}</p>
      <h4>{props.tripLeg.caption || 'No caption'}</h4>
      <Link to={`/map?lat=${props.tripLeg.lat}&lng=${props.tripLeg.lng}`}>
        See on Map
      </Link>
      <div className="slider">
        <button onClick={prevImage}>&lt;</button>
        <img src={props.tripLeg.media_urls[index]} alt="Viewing" style={{ width: '100%', height: "auto", borderRadius: 8, marginTop: 8 }}/>
        <button onClick={nextImage}>&gt;</button>
      </div>
    </div>
  );
}
