import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import type { FriendRequest, FriendUser } from '../types';
import AppHeader from '../components/AppHeader';

function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [targetUsername, setTargetUsername] = useState('');

  async function load() {
    if (!user) return;
    try {
      const friendsData = await apiFetch<FriendUser[]>(`/friends/${user.id}`);
      const requestsData = await apiFetch<FriendRequest[]>(`/friend-requests/${user.id}`);
      setFriends(friendsData);
      setRequests(requestsData);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, [user]);

  async function sendRequest() {
    if (!user || !targetUsername.trim()) return;
    try {
      await apiFetch('/friend-requests', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: user.id,
          target_username: targetUsername,
        }),
      });
      setTargetUsername('');
      await load();
    } catch (err) {
      console.error(err);
      alert('failed to send request');
    }
  }

  async function respond(requestId: string, action: 'accepted' | 'declined') {
    try {
      await apiFetch(`/friend-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: action }),
      });
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <AppHeader />

      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <h1>Friends</h1>

        <div style={{ marginBottom: 24 }}>
          <h2>Send Friend Request</h2>
          <input
            placeholder="username"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
          />
          <button onClick={sendRequest}>send</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2>Pending Requests</h2>
          {requests.length === 0 ? (
            <p>No pending requests.</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} style={{ border: '1px solid #444', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                <p>request from: {req.sender_id}</p>
                <button onClick={() => respond(req.id, 'accepted')}>accept</button>
                <button onClick={() => respond(req.id, 'declined')}>decline</button>
              </div>
            ))
          )}
        </div>

        <div>
          <h2>My Friends</h2>
          {friends.length === 0 ? (
            <p>No friends yet.</p>
          ) : (
            friends.map((friend) => (
              <div key={friend.id} style={{ border: '1px solid #444', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                {friend.username}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default FriendsPage;