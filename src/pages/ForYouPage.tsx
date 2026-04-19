import AppHeader from "../components/AppHeader";
import { useAuth } from "../AuthContext";
import { apiFetch } from "../lib/api";
import type { Trip, FriendUser, TripLeg } from "../types";
import { useEffect, useState } from "react";
import PostComponent from "../components/Post";

type PostProps = {
    tripLeg: TripLeg;
    title: string;
    owner?: string;
    content: string;
};

export default function ForYouPage() {

    const { user } = useAuth();
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [posts, setPosts] = useState<PostProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [shuffledPosts, setShuffledPosts] = useState<PostProps[]>([]);

    async function load() {
          if (!user) return;
          try {
            const friendsData = await apiFetch<FriendUser[]>(`/friends/${user.id}`);
            setFriends(friendsData);

            const loadedTrips: Trip[] = [];
            const loadedPosts: PostProps[] = [];

            for (const friend of friendsData) {
              const friendTrips = await apiFetch<Trip[]>(`/profiles/${friend.id}/trips`);
              for (const trip of friendTrips) {
                loadedTrips.push(trip);
                // Create posts for each trip leg
                for (const leg of trip.legs) {
                    if (!leg.caption && leg.media_urls.length === 0) continue; // Skip if no content
                    const post: PostProps = {
                        tripLeg: leg,
                        title: trip.title,
                        owner: friend.username,
                        content: leg.caption || '',
                    };
                    loadedPosts.push(post);
                }
              }
            }

            setTrips(loadedTrips);
            setPosts(loadedPosts);
       
            const shuffled = [...loadedPosts].sort(() => Math.random() - 0.5);
            setShuffledPosts(shuffled);
          } catch (err) {
            console.error(err);
          } finally {
            setLoading(false);
          }
        }
    
        useEffect(() => {
          load();
        }, [user]);

    return (
        <>
            <AppHeader />
            <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
                <h1>For You</h1>
                {loading && <p>personalized trip recommendations coming soon...</p>}
                {shuffledPosts.map((post, index) => (
                    <PostComponent
                        key={index}
                        tripLeg={post.tripLeg}
                        title={post.title}
                        owner={post.owner}
                        content={post.content}
                    />
                ))}
            </div>
        </>
    );
}