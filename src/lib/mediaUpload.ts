import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'trip-media';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function isDirectUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

function isVideoFile(file: File) {
  return file.type.startsWith('video/');
}

export async function compressImageForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.25,
    maxWidthOrHeight: 1400,
    useWebWorker: true,
    initialQuality: 0.65,
    fileType: 'image/webp',
  });

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([compressed], `${sanitizeFileName(baseName)}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export async function prepareMediaFile(file: File): Promise<File> {
  if (isImageFile(file)) {
    return compressImageForUpload(file);
  }

  if (isVideoFile(file)) {
    throw new Error('video upload is disabled right now to save storage');
  }

  throw new Error('unsupported file type');
}

export async function uploadTripMedia(file: File, userId: string): Promise<string> {
  const prepared = await prepareMediaFile(file);
  const filePath = `${userId}/${Date.now()}-${sanitizeFileName(prepared.name)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, prepared, {
      cacheControl: '3600',
      upsert: false,
      contentType: prepared.type || 'application/octet-stream',
    });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function createSignedMediaUrls(paths: string[], expiresIn = 60 * 60) {
  if (!paths.length) return {};

  const result: Record<string, string> = {};

  const directUrls = paths.filter(isDirectUrl);
  const storagePaths = paths.filter((p) => !isDirectUrl(p));

  for (const url of directUrls) {
    result[url] = url;
  }

  if (!storagePaths.length) {
    return result;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(storagePaths, expiresIn);

  if (error) {
    throw error;
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      result[item.path] = item.signedUrl;
    }
  }

  return result;
}