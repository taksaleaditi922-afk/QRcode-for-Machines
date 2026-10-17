const API = import.meta.env.VITE_API_URL || '';
export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('nexus-token');
  if (token && !options.headers?.Authorization) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API}/api${path}`, { ...options, headers, signal: options.signal || AbortSignal.timeout(15000) });
  } catch (error) {
    if (!navigator.onLine) throw new Error('You appear to be offline. Reconnect and try again.');
    if (error.name === 'TimeoutError') throw new Error('The connection is taking too long. Please try again.');
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : response;
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

export async function downloadFile(path, fallbackName) {
  const response = await request(path);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function compressImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const initialScale = Math.min(1, 1200 / maxSide);
    for (const sizeScale of [1, 0.85, 0.7]) {
      const scale = initialScale * sizeScale;
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.35]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('This image could not be compressed. Choose another image.');
        if (blob.size <= 300 * 1024) {
          return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'machine-photo'}.jpg`, { type: 'image/jpeg' });
        }
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error('This image is still too large after compression. Choose another photo.');
}

export async function uploadImage(file, token) {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append('file', compressed);
  let response;
  try {
    response = await fetch(`${API}/api/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    if (!navigator.onLine) throw new Error('You appear to be offline. Reconnect and try again.');
    if (error.name === 'TimeoutError') throw new Error('The image upload timed out. Try again on a stronger connection.');
    throw new Error('Unable to upload the image. Check your connection and try again.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'The image could not be uploaded.');
  return data;
}
