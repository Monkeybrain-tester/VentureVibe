import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { fetchLikes, toggleLike } from '../lib/likes';

type LikeButtonProps = {
  tripId: string;
};

export default function LikeButton({ tripId }: LikeButtonProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLikes(tripId, user?.id).then((data) => {
      setCount(data.count);
      setLiked(data.liked);
    });
  }, [tripId, user?.id]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || loading) return;
    setLoading(true);
    try {
      const data = await toggleLike(tripId, user.id);
      setCount(data.count);
      setLiked(data.liked);
    } catch (err) {
      console.error('Like failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!user || loading}
      style={{
        background: 'none',
        border: '1px solid #555',
        borderRadius: 20,
        padding: '6px 14px',
        cursor: user ? 'pointer' : 'default',
        color: liked ? '#e05' : '#aaa',
        fontWeight: liked ? 700 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {liked ? '❤️' : '🤍'} {count}
    </button>
  );
}