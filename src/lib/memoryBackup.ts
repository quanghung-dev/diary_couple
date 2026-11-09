import { doc, runTransaction, writeBatch } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db } from './firebase'

function memoryRefs(id: string) {
  return {
    memory: doc(db, 'memories', id),
    backup: doc(db, 'memoryBackups', id),
  }
}

export async function saveNewMemory(id: string, data: DocumentData) {
  const { memory, backup } = memoryRefs(id)
  const batch = writeBatch(db)
  batch.set(memory, data)
  batch.set(backup, data)
  await batch.commit()
}

export async function updateMemoryWithBackup(id: string, patch: DocumentData) {
  const { memory, backup } = memoryRefs(id)
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(memory)
    if (!current.exists()) throw new Error('Không tìm thấy kỷ niệm')
    transaction.update(memory, patch)
    transaction.set(backup, { ...current.data(), ...patch })
  })
}

export async function deleteMemoryWithBackup(id: string) {
  const { memory, backup } = memoryRefs(id)
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(memory)
    if (!current.exists()) return
    transaction.set(backup, current.data())
    transaction.delete(memory)
  })
}

export function recoverMemory(id: string, coupleId: string, mediaFallback?: DocumentData) {
  const { memory, backup } = memoryRefs(id)
  return runTransaction(db, async (transaction) => {
    const current = await transaction.get(memory)
    if (current.exists()) {
      const data = current.data()
      if (data.coupleId !== coupleId) return 'skipped'
      transaction.set(backup, data)
      return 'existing'
    }

    const saved = await transaction.get(backup)
    const data = saved.data() ?? mediaFallback
    if (!data || data.coupleId !== coupleId) return 'skipped'

    transaction.set(memory, data)
    if (!saved.exists()) transaction.set(backup, data)
    return saved.exists() ? 'full' : 'media'
  })
}
