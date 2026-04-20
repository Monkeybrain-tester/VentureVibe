import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../lib/api';
import { createSignedAvatarUrl, isDirectUrl } from '../lib/avatarUpload';
import LikeButton from './LikeButton';

type CommentItem = {
  id: string;
  body: string;
  created_at: string | null;
  updated_at?: string | null;
  author_id: string;
  author_display_name: string;
  author_avatar_url?: string;
  like_count: number;
  liked_by_viewer: boolean;
  trip_id?: string | null;
  leg_id?: string | null;
  trip_title?: string | null;
  leg_title?: string | null;
  can_delete?: boolean;
};

type CommentsSectionProps = {
  mode: 'trip' | 'leg' | 'profile';
  targetId: string;
  title?: string;
  viewerIsAdmin?: boolean;
};

function fallbackInitial(name?: string) {
  if (!name || !name.trim()) return '?';
  return name.trim()[0].toUpperCase();
}

function formatDateOnly(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split('T')[0] || value;
  return date.toLocaleDateString();
}

function CommentsSection({
  mode,
  targetId,
  title,
  viewerIsAdmin = false,
}: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [signedAvatarMap, setSignedAvatarMap] = useState<Record<string, string>>({});

  async function loadComments() {
    if (!targetId) return;

    setLoading(true);
    try {
      const viewerQuery = user?.id ? `?viewer_id=${user.id}` : '';
      let endpoint = '';

      if (mode === 'trip') endpoint = `/trips/${targetId}/comments${viewerQuery}`;
      if (mode === 'leg') endpoint = `/legs/${targetId}/comments${viewerQuery}`;
      if (mode === 'profile') endpoint = `/profiles/${targetId}/comments${viewerQuery}`;

      const data = await apiFetch<CommentItem[]>(endpoint);
      setComments(data);
    } catch (err) {
      console.error('failed loading comments', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [mode, targetId, user?.id]);

  useEffect(() => {
    async function signAvatars() {
      const avatarPaths = Array.from(
        new Set(
          comments
            .map((comment) => comment.author_avatar_url)
            .filter((value): value is string => Boolean(value && value.trim()))
        )
      );

      if (!avatarPaths.length) {
        setSignedAvatarMap({});
        return;
      }

      const result: Record<string, string> = {};

      for (const path of avatarPaths) {
        try {
          if (isDirectUrl(path)) {
            result[path] = path;
          } else {
            result[path] = await createSignedAvatarUrl(path, 60 * 60);
          }
        } catch {
          result[path] = '';
        }
      }

      setSignedAvatarMap(result);
    }

    signAvatars();
  }, [comments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !body.trim() || mode === 'profile') return;

    setSubmitting(true);
    try {
      const endpoint = mode === 'trip'
        ? `/trips/${targetId}/comments`
        : `/legs/${targetId}/comments`;

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          body: body.trim(),
        }),
      });

      setBody('');
      await loadComments();
    } catch (err) {
      console.error(err);
      alert('failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(comment: CommentItem) {
    if (!user?.id) return;

    try {
      const endpoint = comment.liked_by_viewer
        ? `/comments/${comment.id}/unlike`
        : `/comments/${comment.id}/like`;

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id }),
      });

      await loadComments();
    } catch (err) {
      console.error(err);
      alert('failed to update like');
    }
  }

  async function deleteComment(comment: CommentItem) {
    if (!user?.id) return;
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await apiFetch(`/comments/${comment.id}?actor_id=${user.id}`, {
        method: 'DELETE',
      });
      await loadComments();
    } catch (err) {
      console.error(err);
      alert('failed to delete comment');
    }
  }

  const renderedComments = useMemo(() => {
    return comments.map((comment) => {
      const avatarUrl = comment.author_avatar_url
        ? signedAvatarMap[comment.author_avatar_url] || ''
        : '';

      const isAdminDelete = viewerIsAdmin && comment.author_id !== user?.id;
      const commentLink =
        comment.leg_id && comment.trip_id
          ? `/trips/${comment.trip_id}/legs/${comment.leg_id}`
          : comment.trip_id
          ? `/trips/${comment.trip_id}`
          : null;

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
            <Link
              to={`/profile/${comment.author_id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
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

            <div style={{ minWidth: 0 }}>
              <Link
                to={`/profile/${comment.author_id}`}
                style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700 }}
              >
                {comment.author_display_name}
              </Link>
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                {formatDateOnly(comment.created_at)}
              </div>
            </div>
          </div>

          <div>{comment.body}</div>

          {mode === 'profile' && commentLink && (
            <div style={{ opacity: 0.9, fontSize: '0.95rem' }}>
              <Link to={commentLink}>
                {comment.leg_id
                  ? `view comment on ${comment.trip_title || 'trip'} → ${comment.leg_title || 'leg'}`
                  : `view comment on ${comment.trip_title || 'trip'}`}
              </Link>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {user && (
              <LikeButton
                liked={Boolean(comment.liked_by_viewer)}
                count={comment.like_count || 0}
                onClick={() => toggleLike(comment)}
              />
            )}

            {comment.can_delete && user && (
              <button
                type="button"
                onClick={() => deleteComment(comment)}
                style={
                  isAdminDelete
                    ? {
                        background: '#facc15',
                        color: '#1a1a1a',
                        border: '1px solid #eab308',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }
                    : undefined
                }
              >
                delete comment
              </button>
            )}
          </div>
        </div>
      );
    });
  }, [comments, signedAvatarMap, viewerIsAdmin, user?.id, mode]);

  return (
    <div style={{ marginTop: 28 }}>
      <h2>{title || 'Comments'}</h2>

      {mode !== 'profile' && user && (
        <form
          onSubmit={handleSubmit}
          style={{ display: 'grid', gap: 10, marginBottom: 18 }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="write a comment..."
            style={{
              minHeight: 90,
              padding: 12,
              borderRadius: 10,
              border: '1px solid #444',
              background: '#1f1f1f',
              color: '#fff',
            }}
          />
          <div>
            <button type="submit" disabled={submitting || !body.trim()}>
              {submitting ? 'posting...' : 'post comment'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <p>No comments yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>{renderedComments}</div>
      )}
    </div>
  );
}

export default CommentsSection;