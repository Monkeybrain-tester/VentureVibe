import { apiFetch } from './api';
import type { LikeState } from '../types';

export async function fetchLikes(tripId: string, userId?: string): Promise<LikeState> {
  const query = userId ? `?viewer_id=${userId}` : '';
  return apiFetch<LikeState>(`/trips/${tripId}/likes${query}`);
}

export async function toggleLike(tripId: string, userId: string): Promise<LikeState> {
  return apiFetch<LikeState>(`/trips/${tripId}/like`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function fetchLegLikes(legId: string, userId?: string): Promise<LikeState> {
  const query = userId ? `?viewer_id=${userId}` : '';
  return apiFetch<LikeState>(`/legs/${legId}/likes${query}`);
}

export async function toggleLegLike(legId: string, userId: string): Promise<LikeState> {
  return apiFetch<LikeState>(`/legs/${legId}/like`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}