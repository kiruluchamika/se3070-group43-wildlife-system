/*
 * Browser device features for field reports: GPS and photos. Each failure
 * becomes a message the user can act on, and entered data is never lost.
 */

const GEOLOCATION_ERRORS = {
  1: 'Location permission was denied. Allow location access in your browser settings, or describe a landmark instead.',
  2: 'Your position could not be found. Move to an open area and try again, or describe a landmark instead.',
  3: 'Finding your position took too long. Try again, or describe a landmark instead.',
}

/** Resolves to `{ lat, lng, accuracyMeters }` or rejects with a readable message. */
export function captureLocation({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser cannot share your location. Describe a landmark instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lat: Math.round(coords.latitude * 1e6) / 1e6,
          lng: Math.round(coords.longitude * 1e6) / 1e6,
          accuracyMeters: Math.round(coords.accuracy),
        }),
      (error) => reject(new Error(GEOLOCATION_ERRORS[error.code] ?? 'Your location could not be captured.')),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    )
  })
}

const MAX_DIMENSION = 1280
/** Must stay below the server limit (300 000 characters of base64). */
const MAX_DATA_URL_LENGTH = 290000

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`${file.name} could not be read as an image.`))
    }
    image.src = url
  })
}

/**
 * Shrinks a photo to a JPEG data URL small enough to upload, lowering the
 * quality step by step. Rejects with a readable message if it cannot.
 */
export async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return { caption: file.name.slice(0, 120), dataUrl }
  }
  throw new Error(`${file.name} is too detailed to upload. Try a different photo.`)
}
