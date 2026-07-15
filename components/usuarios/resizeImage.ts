// ============================================================================
// Client-side image downscale + compress. Avatars don't need to be large, so
// we shrink the picked file to a small JPEG BEFORE it's sent to the server
// action. This keeps the upload well under the server-action body limit (the
// original bug: real photos are several MB) and makes avatars load fast.
// ============================================================================

export async function resizeImageToFile(file: File, maxSize = 512, quality = 0.85): Promise<File> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Archivo de imagen invalido.'))
    image.src = dataUrl
  })

  let w = img.width
  let h = img.height
  if (w >= h && w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize }
  else if (h > w && h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen.')
  ctx.drawImage(img, 0, 0, w, h)

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      quality,
    ),
  )

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
