import axios from "axios";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadSession(file: File) {
  const { data: create } = await axios.post("/sessions/multipart/create", {
    filename: file.name,
    contentType: file.type,
  });

  const { uploadId, key } = create;

  const parts = [];
  let partNumber = 1;
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    const { data: presigned } = await axios.post("/sessions/multipart/presign", {
      key,
      uploadId,
      partNumber,
    });

    const res = await fetch(presigned.url, {
      method: "PUT",
      body: blob,
    });

    const etag = res.headers.get("ETag")?.replaceAll('"', "");
    parts.push({ PartNumber: partNumber, ETag: etag });

    start = end;
    partNumber++;
  }

  await axios.post("/sessions/multipart/complete", {
    key,
    uploadId,
    parts,
  });
}