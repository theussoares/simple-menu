const MAX_DIMENSION = 1000
const TARGET_MAX_BYTES = 300_000
const QUALITY_STEPS = [0.82, 0.7, 0.6]

export interface OptimizedImage {
  blob: Blob
  originalBytes: number
  optimizedBytes: number
}

export async function optimizeImageToWebp(file: File): Promise<OptimizedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Este navegador não suporta o processamento de imagens necessário.')

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let blob: Blob | null = null
  for (const quality of QUALITY_STEPS) {
    blob = await canvasToWebpBlob(canvas, quality)
    if (blob.size <= TARGET_MAX_BYTES) break
  }
  if (!blob) throw new Error('Não foi possível otimizar a imagem.')

  return { blob, originalBytes: file.size, optimizedBytes: blob.size }
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao converter a imagem.'))),
      'image/webp',
      quality,
    )
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}
