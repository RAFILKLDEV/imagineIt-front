import { api } from './api';

type PresignResponse = {
  uploadUrl: string;
  bucket: string;
  key: string;
  contentType?: string;
};

export async function uploadToS3(
  file: File,
  campanhaId: string,
  tipo: string = 'characters'
): Promise<{ bucket: string; key: string }> {
  if (!file) {
    throw new Error('Arquivo nao informado');
  }

  const { data } = await api.post<PresignResponse>('/upload/presign', {
    campanhaId,
    tipo,
    contentType: file.type,
    fileSize: file.size,
    filename: file.name,
  });

  const uploadResult = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': data.contentType || file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadResult.ok) {
    throw new Error('Erro ao enviar arquivo para o S3');
  }

  return { bucket: data.bucket, key: data.key };
}
