import { apiRequest } from "@/lib/queryClient";

// Function to transcribe audio using the server-side proxy to OpenAI Whisper API
export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${errorText}`);
  }

  return response.json();
}

// Function to handle uploading larger audio files
export async function uploadLargeAudio(audioBlob: Blob, chunkSize = 1024 * 1024): Promise<{ url: string }> {
  // If the file is small enough, send it directly
  if (audioBlob.size <= chunkSize) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  }

  // For larger files, implement chunked upload
  const chunks = Math.ceil(audioBlob.size / chunkSize);
  const uploadId = Date.now().toString();
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, audioBlob.size);
    const chunk = audioBlob.slice(start, end);
    
    const formData = new FormData();
    formData.append('file', chunk, `chunk_${i}`);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', chunks.toString());
    
    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${i}`);
    }
  }
  
  // Complete the upload
  const completeResponse = await apiRequest('POST', '/api/upload/complete', {
    uploadId: uploadId,
    totalChunks: chunks,
    filename: 'audio.webm'
  });
  
  return completeResponse.json();
}
