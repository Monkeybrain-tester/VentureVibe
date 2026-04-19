import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'profile-avatars';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function compressAvatar(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.12,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    initialQuality: 0.7,
    fileType: 'image/webp',
  });

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([compressed], `${sanitizeFileName(baseName)}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const compressed = await compressAvatar(file);
  const path = `${userId}/avatar-${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, compressed, {
      cacheControl: '3600',
      upsert: true,
      contentType: compressed.type,
    });

  if (error) throw error;

  // store path, not signed url
  return path;
}

export async function createSignedAvatarUrl(path: string, expiresIn = 60 * 60) {
  if (!path) return '';

  const { data, error } = await supabase.storage
    .from('profile-avatars')
    .createSignedUrl(path, expiresIn);

  if (error) throw error;

  return data?.signedUrl || '';
}