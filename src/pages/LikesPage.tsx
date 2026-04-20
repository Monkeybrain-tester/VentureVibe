import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import TripCard from '../components/TripCard';
import LikeButton from '../components/LikeButton';
import { createSignedMediaUrls } from '../lib/mediaUpload';
import { createSignedAvatarUrl, isDirectUrl } from '../lib/avatarUpload';
import type { Trip } from '../types';

type LikedTrip = Trip & {
  author_id?: string;
  author_username?: string;
  author_avatar_url?: string;
  like_count?: number;
  liked_by_viewer?: boolean;
};

type LikedLeg = {
  id: string;
  trip_id: string;
  trip_title: string;
  location_name: string;
  caption?: string;
  start_time?: string;
  order_index?: number;
  media_urls?: string[];
  like_count?: number;
  liked_by_viewer?: boolean;
};

type LikedComment = {
  id: string;
  body: string;
  created_at: string | null;
  author_id: string;
  author_display_name: string;
  author_avatar_url?: string;
  trip_id?: string | null;
  leg_id?: string | null;
  trip_title?: string | null;
  leg_title?: string | null;
  like_count?: number;
  liked_by_viewer?: boolean;
};

type LikesResponse = {
  trips: LikedTrip[];
  legs: LikedLeg[];
  comments: LikedComment[];
};

function formatDateOnly(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split('T')[0] || value;
  return date.toLocaleDateString();
}

function fallbackInitial(name?: string) {
  if (!name || !name.trim()) return '?';
  return name.trim()[0].toUpperCase();
}

function LikesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LikesResponse>({ trips: [], legs: [], comments: [] });
  const [loading, setLoading] = useState(true);
  const [signedMediaMap, setSignedMediaMap] = useState<Record<string, string>>({});
  const [signedAvatarMap, setSignedAvatarMap] = useState<Record<string, string>>({});

  async function loadLikes() {
    if (!user?.id) return;
    try {
      const response = await apiFetch<LikesResponse>(`/likes/${user.id}`);
      setData(response);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLikes();
  }, [user?.id]);

  useEffect(() => {
    async function signMedia() {
      const paths = [
        ...data.trips.flatMap((trip) => (trip.legs || []).flatMap((leg) => leg.media_urls || [])),
        ...data.legs.flatMap((leg) => leg.media_urls || []),
      ];

      const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
      if (!uniquePaths.length) {
        setSignedMediaMap({});
        return;
      }

      try {
        const signed = await createSignedMediaUrls(uniquePaths, 60 * 60);
        setSignedMediaMap(signed);
      } catch (err) {
        console.error(err);
      }
    }

    signMedia();
  }, [data]);

  useEffect(() => {
    async function signAvatars() {
      const paths = [
        ...data.trips.map((trip) => trip.author_avatar_url || ''),
        ...data.comments.map((comment) => comment.author_avatar_url || ''),
      ].filter(Boolean);

      const uniquePaths = Array.from(new Set(paths));
      if (!uniquePaths.length) {
        setSignedAvatarMap({});
        return;
      }

      const result: Record<string, string> = {};
      for (const path of uniquePaths) {
        try {
          result[path] = isDirectUrl(path)
            ? path
            : await createSignedAvatarUrl(path, 60 * 60);
        } catch {
          result[path] = '';
        }
      }

      setSignedAvatarMap(result);
    }

    signAvatars();
  }, [data]);

  async function toggleTripLike(tripId: string, liked: boolean) {
    if (!user?.id) return;
    await apiFetch(`/trips/${tripId}/${liked ? 'unlike' : 'like'}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id }),
    });
    await loadLikes();
  }

  async function toggleLegLike(legId: string, liked: boolean) {
    if (!user?.id) return;
    await apiFetch(`/legs/${legId}/${liked ? 'unlike' : 'like'}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id }),
    });
    await loadLikes();
  }

  async function toggleCommentLike(commentId: string, liked: boolean) {
    if (!user?.id) return;
    await apiFetch(`/comments/${commentId}/${liked ? 'unlike' : 'like'}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id }),
    });
    await loadLikes();
  }

  const tripCards = useMemo(() => {
    return data.trips.map((trip) => {
      const firstMediaPath =
        trip.legs?.flatMap((leg) => leg.media_urls || []).find(Boolean) || '';

      return (
        <TripCard
          key={trip.id}
          trip={trip}
          authorId={trip.author_id || trip.user_id}
          authorName={trip.author_username}
          authorAvatarUrl={
            trip.author_avatar_url
              ? signedAvatarMap[trip.author_avatar_url] || ''
              : ''
          }
          thumbnailUrl={signedMediaMap[firstMediaPath] || ''}
          onToggleLike={toggleTripLike}
        />
      );
    });
  }, [data.trips, signedMediaMap, signedAvatarMap]);

  return (
    <>
      <AppHeader />
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <h1>Likes</h1>

        {loading ? (
          <p>Loading likes...</p>
        ) : (
          <>
            <h2>Liked Trips</h2>
            {tripCards.length === 0 ? <p>No liked trips yet.</p> : <div style={{ display: 'grid', gap: 16 }}>{tripCards}</div>}

            <h2 style={{ marginTop: 28 }}>Liked Legs</h2>
            {data.legs.length === 0 ? (
              <p>No liked legs yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {data.legs.map((leg) => {
                  const firstMedia = (leg.media_urls || [])[0];
                  const mediaUrl = firstMedia ? signedMediaMap[firstMedia] || '' : '';

                  return (
                    <Link
                      key={leg.id}
                      to={`/trips/${leg.trip_id}/legs/${leg.id}`}
                      style={{
                        border: '1px solid #444',
                        borderRadius: 12,
                        padding: 16,
                        textDecoration: 'none',
                        display: 'block',
                      }}
                    >
                      <h3>{leg.location_name}</h3>
                      <p>{leg.trip_title}</p>
                      <p>{formatDateOnly(leg.start_time)}</p>
                      {leg.caption && <p>{leg.caption}</p>}
                      <div onClick={(e) => e.preventDefault()}>
                        <LikeButton
                          liked={Boolean(leg.liked_by_viewer)}
                          count={leg.like_count || 0}
                          onClick={() => toggleLegLike(leg.id, Boolean(leg.liked_by_viewer))}
                        />
                      </div>
                      {mediaUrl && (
                        <img
                          src={mediaUrl}
                          alt={leg.location_name}
                          style={{
                            width: '100%',
                            maxWidth: 280,
                            marginTop: 12,
                            borderRadius: 12,
                            objectFit: 'cover',
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            <h2 style={{ marginTop: 28 }}>Liked Comments</h2>
            {data.comments.length === 0 ? (
              <p>No liked comments yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {data.comments.map((comment) => {
                  const avatarUrl = comment.author_avatar_url
                    ? signedAvatarMap[comment.author_avatar_url] || ''
                    : '';

                  const commentLink =
                    comment.leg_id && comment.trip_id
                      ? `/trips/${comment.trip_id}/legs/${comment.leg_id}`
                      : comment.trip_id
                      ? `/trips/${comment.trip_id}`
                      : '/feed';

                  return (
                    <div
                      key={comment.id}
                      style={{
                        border: '1px solid #444',
                        borderRadius: 12,
                        padding: 14,
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Link to={`/profile/${comment.author_id}`}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={comment.author_display_name}
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                border: '1px solid #555',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                              }}
                            >
                              {fallbackInitial(comment.author_display_name)}
                            </div>
                          )}
                        </Link>

                        <div>
                          <Link to={`/profile/${comment.author_id}`}>{comment.author_display_name}</Link>
                          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                            {formatDateOnly(comment.created_at)}
                          </div>
                        </div>
                      </div>

                      <div>{comment.body}</div>

                      <div>
                        <Link to={commentLink}>
                          {comment.leg_id
                            ? `view on ${comment.trip_title || 'trip'} → ${comment.leg_title || 'leg'}`
                            : `view on ${comment.trip_title || 'trip'}`}
                        </Link>
                      </div>

                      <LikeButton
                        liked={Boolean(comment.liked_by_viewer)}
                        count={comment.like_count || 0}
                        onClick={() => toggleCommentLike(comment.id, Boolean(comment.liked_by_viewer))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default LikesPage;