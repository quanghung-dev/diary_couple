import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { MediaItem, Memory } from '../types'

export type ParsedCloudinaryMedia = {
  rawUrl: string
  cleanUrl: string
  publicId: string
  coupleId?: string
  memoryId?: string
  filename?: string
  resourceType: 'photo' | 'video'
}

/**
 * Trích xuất thông tin coupleId, memoryId, publicId từ URL ảnh/video Cloudinary.
 * Ví dụ URL:
 * https://res.cloudinary.com/dl8euunhe/image/upload/v1740000000/couples/CP-123/memories/MEM-456/abc-xyz.jpg
 */
export function parseCloudinaryUrl(url: string): ParsedCloudinaryMedia | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed.includes('cloudinary.com')) return null

  const isVideo = trimmed.match(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i) !== null || trimmed.includes('/video/upload/')
  const resourceType: 'photo' | 'video' = isVideo ? 'video' : 'photo'

  // Loại bỏ query params hoặc transformation nếu cần
  const cleanUrl = trimmed.split('?')[0] ?? trimmed

  // Tìm vị trí của /couples/ trong đường dẫn
  const couplesIdx = cleanUrl.indexOf('/couples/')
  if (couplesIdx === -1) {
    // Trường hợp URL không có đường dẫn chuẩn folder, lấy publicId đơn giản
    const parts = cleanUrl.split('/upload/')
    const publicIdWithExt = parts.length > 1 ? parts[1].replace(/^v\d+\//, '') : cleanUrl
    const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.')) || publicIdWithExt
    return {
      rawUrl: trimmed,
      cleanUrl,
      publicId,
      resourceType,
    }
  }

  // Đường dẫn dạng: /couples/{coupleId}/memories/{memoryId}/{filename}
  const relativePath = cleanUrl.substring(couplesIdx + 1) // couples/{coupleId}/memories/{memoryId}/...
  const pathParts = relativePath.split('/')

  let coupleId: string | undefined
  let memoryId: string | undefined
  let filename: string | undefined

  if (pathParts[0] === 'couples' && pathParts[1]) {
    coupleId = pathParts[1]
  }

  if (pathParts[2] === 'memories' && pathParts[3]) {
    memoryId = pathParts[3]
  }

  filename = pathParts[pathParts.length - 1]

  // publicId đầy đủ trong Cloudinary: couples/{coupleId}/memories/{memoryId}/{filename_without_ext}
  const publicIdWithExt = relativePath
  const dotIndex = publicIdWithExt.lastIndexOf('.')
  const publicId = dotIndex !== -1 ? publicIdWithExt.substring(0, dotIndex) : publicIdWithExt

  return {
    rawUrl: trimmed,
    cleanUrl,
    publicId,
    coupleId,
    memoryId,
    filename,
    resourceType,
  }
}

/**
 * Tự động nhóm danh sách URL Cloudinary và tạo lại các document Memory trong Firestore
 */
export async function autoRestoreMemoriesFromCloudinary(params: {
  urls: string[]
  coupleId: string
  userId: string
  onProgress?: (processed: number, total: number, restoredMemoriesCount: number) => void
}): Promise<{ restoredCount: number; memoryIds: string[] }> {
  const { urls, coupleId, userId, onProgress } = params

  // 1. Phân tích các URL
  const parsedList: ParsedCloudinaryMedia[] = []
  for (const u of urls) {
    const parsed = parseCloudinaryUrl(u)
    if (parsed) parsedList.push(parsed)
  }

  if (parsedList.length === 0) {
    throw new Error('Không tìm thấy URL Cloudinary hợp lệ nào trong danh sách cung cấp.')
  }

  // 2. Nhóm media theo memoryId (nếu không có memoryId thì gộp vào 1 nhóm fallback)
  const memoryGroups = new Map<string, ParsedCloudinaryMedia[]>()
  const standaloneMedia: ParsedCloudinaryMedia[] = []

  for (const item of parsedList) {
    const memId = item.memoryId
    if (memId) {
      const existing = memoryGroups.get(memId) || []
      existing.push(item)
      memoryGroups.set(memId, existing)
    } else {
      standaloneMedia.push(item)
    }
  }

  // Nếu có ảnh rời rạc không nằm trong folder memoryId cụ thể, nhóm chúng vào 1 memoryId mới
  if (standaloneMedia.length > 0) {
    const fallbackId = `restored-memory-${Date.now()}`
    memoryGroups.set(fallbackId, standaloneMedia)
  }

  const totalGroups = memoryGroups.size
  let processedGroups = 0
  const restoredMemoryIds: string[] = []

  // 3. Tiến hành tạo document cho từng Kỷ niệm
  for (const [memId, mediaItemsList] of memoryGroups.entries()) {
    const now = Timestamp.now()

    const mediaItems: MediaItem[] = mediaItemsList.map((m, idx) => ({
      id: `media-${idx + 1}-${Date.now()}`,
      type: m.resourceType,
      url: m.cleanUrl,
      thumbnailUrl: m.resourceType === 'video' ? m.cleanUrl : '',
      storagePath: m.publicId,
      caption: '',
      width: 0,
      height: 0,
      order: idx,
    }))

    const memoryData: Memory = {
      memoryId: memId,
      coupleId,
      title: `Kỷ niệm khôi phục ${restoredMemoryIds.length + 1}`,
      date: now,
      location: '',
      description: 'Kỷ niệm được tự động khôi phục từ Cloudinary.',
      mood: 'happy',
      mediaItems,
      coverMediaId: mediaItems[0]?.id ?? null,
      tags: ['khôi-phục', 'cloudinary'],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }

    const docRef = doc(db, 'memories', memId)
    await setDoc(docRef, memoryData, { merge: true })

    restoredMemoryIds.push(memId)
    processedGroups++
    onProgress?.(processedGroups, totalGroups, restoredMemoryIds.length)
  }

  return {
    restoredCount: restoredMemoryIds.length,
    memoryIds: restoredMemoryIds,
  }
}
