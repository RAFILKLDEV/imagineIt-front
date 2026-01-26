/**
 * Upload direto para S3 usando URL pré-assinada
 * NÃO envia arquivo para o backend
 */

type PresignResponse = {
  uploadUrl: string;
  fileUrl: string;
};

export async function uploadToS3(
  file: File,
  campanhaId: string,
  tipo: string = "characters"
): Promise<string> {
  if (!file) {
    throw new Error("Arquivo não informado");
  }

  // 1️⃣ Pede a URL pré-assinada para o backend
  const presignResponse = await fetch("http://localhost:4000/upload/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campanhaId,
      tipo,
      contentType: file.type,
    }),
  });

  if (!presignResponse.ok) {
    throw new Error("Erro ao obter URL de upload");
  }

  const { uploadUrl, fileUrl }: PresignResponse =
    await presignResponse.json();

  // 2️⃣ Faz upload direto no S3
  const uploadResult = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResult.ok) {
    throw new Error("Erro ao enviar arquivo para o S3");
  }

  // 3️⃣ Retorna apenas a URL final (salve no banco)
  return fileUrl;
}
