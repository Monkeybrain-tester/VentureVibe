import { useRef, useState } from 'react';
import { uploadTripMedia } from '../lib/mediaUpload';

type MediaUploadBoxProps = {
  userId: string;
  mediaPaths: string[];
  onChange: (paths: string[]) => void;
};

function MediaUploadBox({ userId, mediaPaths, onChange }: MediaUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      const files = Array.from(fileList);
      const uploadedPaths: string[] = [];

      for (const file of files) {
        const path = await uploadTripMedia(file, userId);
        uploadedPaths.push(path);
      }

      onChange([...mediaPaths, ...uploadedPaths]);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'failed to upload media');
    } finally {
      setUploading(false);
    }
  }

  function removePath(pathToRemove: string) {
    onChange(mediaPaths.filter((path) => path !== pathToRemove));
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#646cff' : '#666'}`,
          borderRadius: 12,
          padding: 20,
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        <p style={{ margin: 0 }}>
          {uploading
            ? 'compressing + uploading...'
            : 'drag image files here or click to upload'}
        </p>
        <p style={{ marginTop: 8, opacity: 0.8, fontSize: '0.9rem' }}>
          images are aggressively compressed before upload
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {mediaPaths.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {mediaPaths.map((path) => (
            <div
              key={path}
              style={{
                border: '1px solid #444',
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{path}</div>
              <button type="button" onClick={() => removePath(path)}>
                remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MediaUploadBox;