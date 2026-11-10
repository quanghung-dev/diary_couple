import type { Timestamp } from 'firebase/firestore'

export type MoodKey =
  | 'romantic'
  | 'happy'
  | 'adventure'
  | 'peaceful'
  | 'special'
  | 'missing'

export type MoodOption = {
  key: MoodKey
  emoji: string
  label: string
}

export const MOODS: MoodOption[] = [
  { key: 'romantic', emoji: '🥰', label: 'Lãng mạn' },
  { key: 'happy', emoji: '😊', label: 'Vui vẻ' },
  { key: 'adventure', emoji: '🌊', label: 'Phiêu lưu' },
  { key: 'peaceful', emoji: '☕', label: 'Bình yên' },
  { key: 'special', emoji: '🎉', label: 'Đặc biệt' },
  { key: 'missing', emoji: '😢', label: 'Nhớ nhung' },
]

export type MediaItem = {
  id: string
  type: 'photo' | 'video'
  url: string
  thumbnailUrl: string
  storagePath: string // Cloudinary public_id
  caption: string
  width: number
  height: number
  order: number
}

export type Memory = {
  memoryId?: string
  coupleId: string
  title: string
  date: Timestamp
  location: string
  description: string
  mood: MoodKey
  mediaItems: MediaItem[]
  coverMediaId?: string | null
  coverFocalX?: number
  coverFocalY?: number
  /** Tọa độ từ tìm kiếm địa điểm (OpenStreetMap) — cần để hiển thị trên bản đồ */
  lat?: number
  lng?: number
  /** Tên địa điểm đầy đủ từ geocoding (tuỳ chọn) */
  locationName?: string
  songUrl?: string
  songType?: 'youtube' | 'spotify' | null
  tags: string[]
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  revision?: number
  revisionId?: string
  deletedAt?: Timestamp | null
  deletedBy?: string | null
}

export type MemoryVersion = {
  revision: number
  action: 'create' | 'edit' | 'delete' | 'undelete' | 'recover' | 'baseline' | 'restoreVersion'
  actorUid: string
  recordedAt: Timestamp
  snapshot: Memory
}

export type BucketCategory =
  | 'travel'
  | 'food'
  | 'experience'
  | 'celebration'
  | 'other'

export type BucketPriority = 'high' | 'medium' | 'low'

export type BucketItem = {
  coupleId: string
  title: string
  description: string
  category: BucketCategory
  priority: BucketPriority
  completed: boolean
  completedAt: Timestamp | null
  linkedMemoryId: string | null
  createdAt: Timestamp
  createdBy: string
}

export type Couple = {
  coupleId: string
  user1: string
  user2: string | null
  createdAt: Timestamp
  startDate: Timestamp
  inviteToken?: string
  inviteTokenCreatedAt?: Timestamp
}

