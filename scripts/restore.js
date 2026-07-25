/**
 * Script Node.js chạy từ Terminal để tự động quét Cloudinary và khôi phục vào Firebase Firestore.
 * Chạy lệnh: node scripts/restore.js <API_KEY> <API_SECRET> [COUPLE_ID]
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const apiKey = process.argv[2] || process.env.VITE_CLOUDINARY_API_KEY
const apiSecret = process.argv[3] || process.env.VITE_CLOUDINARY_API_SECRET
const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME || 'dl8euunhe'
const coupleId = process.argv[4] || 'CP-default'

if (!apiKey || !apiSecret) {
  console.error('❌ Thiếu API Key hoặc API Secret!')
  console.log('Cách dùng: node scripts/restore.js <API_KEY> <API_SECRET> [COUPLE_ID]')
  process.exit(1)
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

function deriveTitle(filename, index) {
  if (!filename) return `Kỷ niệm yêu thương ${index + 1}`
  let name = filename.replace(/\.[^/.]+$/, '')
  name = name.replace(/^[a-f0-9-]{30,}_?/i, '')
  name = name.replace(/^[0-9a-zA-Z]{15,}[-_]/, '')
  const cleaned = name.replace(/[-_]+/g, ' ').trim()
  if (cleaned.length > 2 && !/^\d+$/.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  return `Kỷ niệm yêu thương ${index + 1}`
}

async function run() {
  console.log(`🔍 Đang quét toàn bộ ảnh trên Cloudinary (${cloudName})...`)
  const authHeader = 'Basic ' + Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`
  const res = await fetch(url, {
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

  if (!res.ok) {
    console.error(`❌ Cloudinary API Error (${res.status}):`, await res.text())
    process.exit(1)
  }

  const data = await res.json()
  const resources = data.resources || []
  console.log(`🎉 Tìm thấy ${resources.length} ảnh/video!`)

  const memoryGroups = new Map()

  for (const item of resources) {
    const cleanUrl = item.secure_url || item.url
    const publicId = item.public_id || ''
    const isVideo = item.resource_type === 'video'

    const parts = publicId.split('/')
    let memId = 'restored-memory'
    let cId = coupleId
    let filename = parts[parts.length - 1]

    if (parts[0] === 'couples' && parts[1]) cId = parts[1]
    if (parts[2] === 'memories' && parts[3]) memId = parts[3]

    const list = memoryGroups.get(memId) || { coupleId: cId, items: [], filename }
    list.items.push({
      id: `media-${list.items.length + 1}-${Date.now()}`,
      type: isVideo ? 'video' : 'photo',
      url: cleanUrl,
      thumbnailUrl: isVideo ? cleanUrl : '',
      storagePath: publicId,
      caption: '',
      width: item.width || 0,
      height: item.height || 0,
      order: list.items.length,
    })
    memoryGroups.set(memId, list)
  }

  let count = 0
  for (const [memId, group] of memoryGroups.entries()) {
    const now = Timestamp.now()
    const title = deriveTitle(group.filename, count)
    const memoryData = {
      memoryId: memId,
      coupleId: group.coupleId,
      title,
      date: now,
      location: '',
      description: 'Kỷ niệm được tự động khôi phục từ Cloudinary.',
      mood: 'happy',
      mediaItems: group.items,
      coverMediaId: group.items[0]?.id ?? null,
      tags: ['khôi-phục', 'cloudinary'],
      createdBy: 'auto-restore-script',
      createdAt: now,
      updatedAt: now,
    }

    await setDoc(doc(db, 'memories', memId), memoryData, { merge: true })
    count++
    console.log(`✅ [${count}/${memoryGroups.size}] Đã khôi phục: "${title}" (${memId}) - ${group.items.length} media`)
  }

  console.log(`🚀 HOÀN THÀNH: Đã khôi phục thành công ${count} bài viết kỷ niệm vào Firestore!`)
}

run().catch(console.error)
