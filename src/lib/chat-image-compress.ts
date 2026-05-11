/** 720p frame: fit inside while preserving aspect ratio. */
const FRAME_W = 1280
const FRAME_H = 720

/** Client target before upload (Convex also enforces a server-side ceiling). */
const CLIENT_MAX_BYTES = 250 * 1024

const ABS_MIN_QUALITY = 0.38

function fitInsideFrame(
  nw: number,
  nh: number,
  frameW: number,
  frameH: number,
) {
  const s = Math.min(frameW / nw, frameH / nh, 1)
  return {
    w: Math.max(1, Math.round(nw * s)),
    h: Math.max(1, Math.round(nh * s)),
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error('Could not encode image as JPEG.')),
      'image/jpeg',
      quality,
    )
  })
}

/** Resize and compress `file` toward ~720p framing and roughly 100–250KB JPEG. */
export async function compressLobbyChatImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }

  const bmp = await loadBitmap(file)

  try {
    let { w, h } = fitInsideFrame(bmp.width, bmp.height, FRAME_W, FRAME_H)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('This browser cannot encode chat images.')
    }

    for (let downsize = 0; downsize < 7; downsize++) {
      canvas.width = w
      canvas.height = h
      ctx.drawImage(bmp, 0, 0, w, h)

      for (
        let q = 0.88;
        q >= ABS_MIN_QUALITY;
        q -= q > 0.62 ? 0.06 : 0.045
      ) {
        const blob = await jpegBlob(canvas, q)
        if (blob.size <= CLIENT_MAX_BYTES) {
          return blob
        }
      }

      const nw = Math.max(1, Math.floor(w * 0.88))
      const nh = Math.max(1, Math.floor(h * 0.88))
      if (nw === w && nh === h) break
      w = nw
      h = nh
    }

    throw new Error(
      'Photo is still too large after compression — try another image.',
    )
  } finally {
    bmp.close()
  }
}
