import { api } from '../services/api';

const CHUNK_SIZE = 5 * 1024 * 1024;

export async function uploadSession(file: File, campanhaId: string) {
  const { data: create } = await api.post('/upload/multipart/create', {
    campanhaId,
    tipo: 'sessions',
    filename: file.name,
    contentType: file.type,
    fileSize: file.size
  });

  const { uploadId, key, bucket } = create as {
    uploadId: string;
    key: string;
    bucket: string;
  };

  const parts: { PartNumber: number; ETag: string }[] = [];
  let partNumber = 1;
  let start = 0;

  try {
    while (start < file.size) {
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const { data: presigned } = await api.post<{ url: string }>('/upload/multipart/presign-part', {
        key,
        uploadId,
        partNumber
      });

      const res = await fetch(presigned.url, {
        method: 'PUT',
        body: blob
      });
      if (!res.ok) throw new Error(`Upload failed for part ${partNumber}`);

      const etag = res.headers.get('ETag')?.replaceAll('"', '');
      if (!etag) throw new Error(`Missing ETag for part ${partNumber}`);
      parts.push({ PartNumber: partNumber, ETag: etag });

      start = end;
      partNumber += 1;
    }

    await api.post('/upload/multipart/complete', {
      key,
      uploadId,
      parts
    });

    return { bucket, key };
  } catch (error) {
    await api.post('/upload/multipart/abort', { key, uploadId }).catch(() => undefined);
    throw error;
  }
}
