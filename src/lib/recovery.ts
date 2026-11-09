import { collection, getDocsFromServer, query, Timestamp, where } from 'firebase/firestore'
import { auth, db } from './firebase'
import { recoverMemory } from './memoryBackup'
import type { Memory } from '../types'

type CloudAsset = {
  memoryId: string
  publicId: string
  url: string
  type: 'photo' | 'video'
  createdAt: string
  width: number
  height: number
}

async function getLegacyMedia(coupleId: string, token: string) {
  const groups = new Map<string, Map<string, CloudAsset>>()
  let cursor: string | undefined
  do {
    const params = new URLSearchParams({ coupleId })
    if (cursor) params.set('cursor', cursor)
    const response = await fetch(`/api/recovery-media?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error('Không thể truy cập Cloudinary')
    const page = await response.json() as { assets: CloudAsset[]; cursor?: string }
    for (const asset of page.assets) {
      const group = groups.get(asset.memoryId) ?? new Map<string, CloudAsset>()
      group.set(asset.url, asset)
      groups.set(asset.memoryId, group)
    }
    cursor = page.cursor
  } while (cursor)
  return groups
}

function rebuildFromMedia(
  memoryId: string,
  coupleId: string,
  userId: string,
  group: Map<string, CloudAsset>,
): Memory | undefined {
  const assets = [...group.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const mediaItems = assets.filter((asset) => !asset.publicId.endsWith('-thumb')).map((asset, order) => ({
    id: `media-${order + 1}`,
    type: asset.type,
    url: asset.url,
    thumbnailUrl: asset.type === 'video'
      ? assets.find((thumbnail) => thumbnail.publicId === `${asset.publicId}-thumb`)?.url ?? ''
      : '',
    storagePath: asset.publicId,
    caption: '',
    width: asset.width,
    height: asset.height,
    order,
  }))
  if (!mediaItems.length) return undefined
  const uploadedAt = Date.parse(assets[0]!.createdAt)
  const date = Number.isFinite(uploadedAt) ? Timestamp.fromMillis(uploadedAt) : Timestamp.now()

  return {
    memoryId,
    coupleId,
    title: 'Kỷ niệm đã khôi phục',
    description: '',
    date,
    location: '',
    mood: 'happy',
    mediaItems,
    coverMediaId: mediaItems[0]!.id,
    tags: [],
    createdBy: userId,
    createdAt: date,
    updatedAt: Timestamp.now(),
  }
}

export async function restoreMemories(coupleId: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Vui lòng đăng nhập để khôi phục kỷ niệm')

  const forCouple = where('coupleId', '==', coupleId)
  const [live, backups] = await Promise.all([
    getDocsFromServer(query(collection(db, 'memories'), forCouple)),
    getDocsFromServer(query(collection(db, 'memoryBackups'), forCouple)),
  ])
  let full = 0
  let media = 0
  const knownIds = new Set([...live.docs, ...backups.docs].map((snapshot) => snapshot.id))

  for (const id of knownIds) {
    if (await recoverMemory(id, coupleId) === 'full') full++
  }

  let cloudAvailable = true
  const groups = await getLegacyMedia(coupleId, await user.getIdToken()).catch((error: unknown) => {
    console.error(error)
    cloudAvailable = false
    return undefined
  })
  for (const [id, group] of groups ?? []) {
    if (knownIds.has(id)) continue
    const fallback = rebuildFromMedia(id, coupleId, user.uid, group)
    if (!fallback) continue
    const result = await recoverMemory(id, coupleId, fallback)
    if (result === 'full') full++
    if (result === 'media') media++
  }

  return { full, media, cloudAvailable }
}
