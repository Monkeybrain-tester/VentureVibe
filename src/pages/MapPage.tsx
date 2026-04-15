import { useState, useEffect } from "react";
import MapComponent from "../components/Map";
import AppHeader from "../components/AppHeader";
import type { FriendUser } from "../types";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../lib/api";
import type { Trip } from "../types";
import { useSearchParams } from 'react-router-dom';

function GetCenter() {
  const [searchParams] = useSearchParams();
  const center = searchParams.get('lat') && searchParams.get('lng') ? {
    lat: parseFloat(searchParams.get('lat')!),
    lng: parseFloat(searchParams.get('lng')!)
  } : {
  lat: 29.6516,
  lng: -82.3248
};
  return center;
}

const apiKey = import.meta.env.VITE_Key;

type MapMarker = {
  lat: number;
  lng: number;
};

function MapPage() {
  const { user } = useAuth();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  async function load() {
      if (!user) return;
      try {
        const friendsData = await apiFetch<FriendUser[]>(`/friends/${user.id}`);
        setFriends(friendsData);
        for (const friend of friendsData) {
          const friendTrips = await apiFetch<Trip[]>(`/profiles/${friend.id}/trips`);
          console.log(`Trips for friend ${friend.username}:`, friendTrips);
          for (const trip of friendTrips) {
            setTrips((prev) => [...prev, trip]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    useEffect(() => {
      load();
    }, [user]);



  return (
    <>
      <AppHeader />
      <MapComponent trips={trips} center={GetCenter()} />
    </>
  );
}

export default MapPage;