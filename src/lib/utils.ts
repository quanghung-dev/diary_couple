import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function formatViFullDate(date: Date | Timestamp) {
  const d = date instanceof Date ? date : date.toDate()
  return format(d, 'EEEE, d MMMM yyyy', { locale: vi })
}

export function formatViMonthYear(date: Date | Timestamp) {
  const d = date instanceof Date ? date : date.toDate()
  return format(d, 'MMMM yyyy', { locale: vi })
}

export function formatViYear(date: Date | Timestamp) {
  const d = date instanceof Date ? date : date.toDate()
  return format(d, 'yyyy', { locale: vi })
}

/** Khóa yyyy-MM-dd theo giờ địa phương (dùng cho lịch / nhóm kỷ niệm). */
export function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export function humanFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  const n = bytes / Math.pow(k, i)
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function isVideoFile(file: File) {
  return file.type.startsWith('video/')
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

/**
 * Trả về đường dẫn thumbnail dạng ảnh (JPG/PNG) chuẩn cho cả photo và video.
 * Nếu là Cloudinary video URL, tự động chuyển đổi extension .mp4 -> .jpg để Cloudinary sinh thumbnail ảnh.
 */
export function getMediaThumbnailUrl(media?: {
  type?: 'photo' | 'video' | string
  url?: string
  thumbnailUrl?: string
}): string {
  if (!media) return ''
  if (media.type === 'photo') return media.url || ''

  const thumb = media.thumbnailUrl || ''
  if (thumb && thumb.match(/\.(jpg|jpeg|png|webp|avif)(\?.*)?$/i)) {
    return thumb
  }

  const url = media.url || ''
  if (url.includes('cloudinary.com')) {
    return url.replace(/\.(mp4|mov|webm|mkv|avi)(\?.*)?$/i, '.jpg')
  }

  return thumb || url
}

export async function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(video.src)
    }

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('Không thể đọc video để tạo thumbnail'))
    })

    video.addEventListener('loadedmetadata', () => {
      const seekTo = Math.min(1, Math.max(0, (video.duration ?? 0) / 3))
      video.currentTime = seekTo
    })

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      cleanup()
      resolve(dataUrl)
    })
  })
}

export async function getVideoDimensions(file: File): Promise<{
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(video.src)
    }

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('Không thể đọc video'))
    })

    video.addEventListener('loadedmetadata', () => {
      const width = video.videoWidth
      const height = video.videoHeight
      cleanup()
      resolve({ width, height })
    })
  })
}

export async function getImageDimensions(file: File): Promise<{
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Không thể đọc ảnh'))
    }
    img.src = URL.createObjectURL(file)
  })
}

export function dataUrlToBlob(dataUrl: string) {
  const [meta, content] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(meta ?? '')?.[1] ?? 'application/octet-stream'
  const bin = atob(content ?? '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
