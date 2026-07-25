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

type CloudinaryResource = {
  secure_url?: string
  url?: string
}

type CloudinarySearchResponse = {
  resources?: CloudinaryResource[]
}

/**
 * Trích xuất tiêu đề gợi ý thông minh từ tên file gốc của ảnh/video
 */
export function deriveTitleFromMedia(mediaItems: ParsedCloudinaryMedia[], index: number): string {
  for (const m of mediaItems) {
    if (!m.filename) continue
    // Tách bỏ phần mở rộng file (.jpg, .png, .mp4...)
    let name = m.filename.replace(/\.[^/.]+$/, '')
    // Bóc tách UUID / ID prefix được sinh ngẫu nhiên lúc upload (ví dụ: "c8e1a7b2-3f4d-..." hoặc "174000000-...")
    name = name.replace(/^[a-f0-9-]{30,}_?/i, '')
    name = name.replace(/^[0-9a-zA-Z]{15,}[-_]/, '')

    // Chuyển dấu gạch dưới / gạch ngang thành khoảng trắng
    const cleaned = name.replace(/[-_]+/g, ' ').trim()

    // Nếu tiêu đề hợp lệ (dài hơn 2 ký tự và không chỉ toàn số)
    if (cleaned.length > 2 && !/^\d+$/.test(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
  }

  return `Kỷ niệm yêu thương ${index + 1}`
}

/**
 * Gọi API Cloudinary Search tự động quét và lấy danh sách URL tất cả ảnh/video.
 * Dùng CORS Proxy để tránh rào cản CORS khi gọi Cloudinary Admin API trực tiếp từ trình duyệt.
 */
export async function fetchCloudinaryResourcesApi(params: {
  cloudName: string
  apiKey: string
  apiSecret: string
  coupleId?: string
}): Promise<string[]> {
  const { cloudName, apiKey, apiSecret, coupleId } = params
  const authHeader = 'Basic ' + btoa(`${apiKey.trim()}:${apiSecret.trim()}`)

  const targetUrl = `https://api.cloudinary.com/v1_1/${cloudName.trim()}/resources/search`
  const expression = coupleId ? `folder:couples/${coupleId}/*` : `folder:couples/*`

  // Thử các giải pháp CORS proxy để vượt qua rào cản CORS của trình duyệt
  const corsProxies = [
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    targetUrl,
  ]

  let lastError: Error | null = null
  let data: CloudinarySearchResponse | null = null

  for (const proxyUrl of corsProxies) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expression,
          max_results: 500,
        }),
      })

      if (response.ok) {
        data = (await response.json()) as CloudinarySearchResponse
        break
      } else {
        const errorText = await response.text()
        lastError = new Error(`Lỗi Cloudinary API (${response.status}): ${errorText}`)
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  if (!data) {
    throw (
      lastError ||
      new Error(
        'Trình duyệt chặn kết nối CORS tới Cloudinary. Bạn vui lòng dùng nút "Dán URL thủ công" hoặc kiểm tra lại API Key / Secret.',
      )
    )
  }

  const resources = data.resources

  if (!resources || !Array.isArray(resources) || resources.length === 0) {
    // Fallback: Tìm tất cả ảnh & video nếu không khớp đường dẫn folder cụ thể
    for (const proxyUrl of corsProxies) {
      try {
        const fallbackRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expression: 'resource_type:image OR resource_type:video',
            max_results: 500,
          }),
        })

        if (fallbackRes.ok) {
          const fallbackData = (await fallbackRes.json()) as CloudinarySearchResponse
          if (fallbackData?.resources && Array.isArray(fallbackData.resources)) {
            return fallbackData.resources
              .map((r: CloudinaryResource) => r.secure_url || r.url)
              .filter((u): u is string => Boolean(u))
          }
        }
      } catch {
        // continue trying next proxy
      }
    }

    return []
  }

  return resources
    .map((r: CloudinaryResource) => r.secure_url || r.url)
    .filter((u): u is string => Boolean(u))
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
    const filename = publicIdWithExt.substring(publicIdWithExt.lastIndexOf('/') + 1)
    return {
      rawUrl: trimmed,
      cleanUrl,
      publicId,
      filename,
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

    // Trích xuất tiêu đề gợi ý từ tên file ảnh gốc
    const suggestedTitle = deriveTitleFromMedia(mediaItemsList, restoredMemoryIds.length)

    const memoryData: Memory = {
      memoryId: memId,
      coupleId,
      title: suggestedTitle,
      date: now,
      location: '',
      description: 'Kỷ niệm được tự động khôi phục từ Cloudinary. Bạn có thể nhấn chỉnh sửa để cập nhật mô tả và tiêu đề theo ý muốn.',
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
