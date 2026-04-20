import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { Trip } from '../types';
import LikeButton from './LikeButton';

type TripWithAuthor = Trip & {
  author_id?: string;
  author_username?: string;
  author_avatar_url?: string;
  like_count?: number;
  liked_by_viewer?: boolean;
};

type TripCardProps = {
  trip: TripWithAuthor;
  authorId?: string;
  authorName?: string;
  authorAvatarUrl?: string;
  thumbnailUrl?: string;
  onToggleLike?: (tripId: string, liked: boolean) => void;
};

function fallbackInitial(name?: string) {
  if (!name || !name.trim()) return '?';
  return name.trim()[0].toUpperCase();
}

function TripCard({
  trip,
  authorId,
  authorName,
  authorAvatarUrl,
  thumbnailUrl,
  onToggleLike,
}: TripCardProps) {
  const navigate = useNavigate();
  const [avatarFailed, setAvatarFailed] = useState(false);

  const resolvedAuthorId = authorId || trip.author_id || trip.user_id;
  const resolvedAuthorName = authorName || trip.author_username || 'unknown user';
  const resolvedAuthorAvatar = authorAvatarUrl || trip.author_avatar_url || '';

  useEffect(() => {
    setAvatarFailed(false);
  }, [resolvedAuthorAvatar]);

  const avatarNode =
    resolvedAuthorAvatar && !avatarFailed ? (
      <img
        src={resolvedAuthorAvatar}
        alt={resolvedAuthorName}
        onError={() => setAvatarFailed(true)}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
        }}
      />
    ) : (
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #555',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {fallbackInitial(resolvedAuthorName)}
      </div>
    );

  return (
    <div
      onClick={() => navigate(`/trips/${trip.id}`)}
      style={{
        display: 'block',
        border: '1px solid #444',
        borderRadius: 14,
        padding: 16,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Link
              to={`/profile/${resolvedAuthorId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {avatarNode}
            </Link>

            <div style={{ minWidth: 0 }}>
              <Link
                to={`/profile/${resolvedAuthorId}`}
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontWeight: 700 }}>{resolvedAuthorName}</div>
              </Link>

              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                {trip.visibility} · {trip.status}
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 0, marginBottom: 10 }}>{trip.title}</h3>

          {trip.description && (
            <p style={{ margin: '0 0 12px 0' }}>{trip.description}</p>
          )}

          <div style={{ display: 'grid', gap: 6 }}>
            <div>start: {trip.start_location_name || 'unknown'}</div>
            <div>legs: {trip.legs?.length ?? 0}</div>
          </div>

          {onToggleLike && (
            <div style={{ marginTop: 12 }}>
              <LikeButton
                liked={Boolean(trip.liked_by_viewer)}
                count={trip.like_count || 0}
                onClick={() => onToggleLike(trip.id, Boolean(trip.liked_by_viewer))}
              />
            </div>
          )}
        </div>

        <div
          style={{
            width: '100%',
            minHeight: 170,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a1a',
          }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${trip.title} thumbnail`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                minHeight: 170,
              }}
            />
          ) : (
            <div style={{ opacity: 0.7, padding: 12, textAlign: 'center' }}>
              no media
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TripCard;