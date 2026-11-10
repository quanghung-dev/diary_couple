import {
  collection,
  doc,
  getDocsFromServer,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import type { DocumentData, Transaction } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Memory, MemoryVersion } from '../types'

function memoryRefs(id: string) {
  const backup = doc(db, 'memoryBackups', id)
  return {
    memory: doc(db, 'memories', id),
    backup,
    versions: collection(backup, 'versions'),
  }
}

function actorUid() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Vui lòng đăng nhập')
  return uid
}

async function changeMemory<T>(change: (transaction: Transaction) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    let staged = false
    try {
      return await runTransaction(db, async (transaction) => {
        staged = false
        const result = await change(transaction)
        staged = true
        return result
      })
    } catch (error) {
      // A concurrent revision may fail the rules check before Firestore reports a write conflict.
      if (!staged || attempt === 2 || !(error instanceof Error) ||
          !('code' in error) || error.code !== 'permission-denied') throw error
    }
  }
}

function writeRevision(
  transaction: Transaction,
  refs: ReturnType<typeof memoryRefs>,
  uid: string,
  action: MemoryVersion['action'],
  data: DocumentData,
  previous?: DocumentData,
) {
  let revision = previous?.revision ?? 0
  if (previous && !revision) {
    revision = 1
    transaction.set(doc(refs.versions), {
      revision, action: 'baseline', actorUid: uid, recordedAt: serverTimestamp(), snapshot: previous,
    })
  }

  const version = doc(refs.versions)
  const deleted = action === 'delete'
  const snapshot = {
    ...data,
    revision: revision + 1,
    revisionId: version.id,
    deletedAt: deleted ? serverTimestamp() : null,
    deletedBy: deleted ? uid : null,
  }
  transaction.set(refs.backup, snapshot)
  transaction.set(version, {
    revision: snapshot.revision, action, actorUid: uid, recordedAt: serverTimestamp(), snapshot,
  })
  if (deleted) transaction.delete(refs.memory)
  else transaction.set(refs.memory, snapshot)
}

export async function saveNewMemory(id: string, data: DocumentData) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  await changeMemory(async (transaction) => {
    const current = await transaction.get(refs.memory)
    const saved = await transaction.get(refs.backup)
    if (current.exists() || saved.exists()) throw new Error('Kỷ niệm này đã tồn tại')
    writeRevision(transaction, refs, uid, 'create', data)
  })
}

export async function updateMemoryWithBackup(id: string, patch: DocumentData) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  await changeMemory(async (transaction) => {
    const current = (await transaction.get(refs.memory)).data()
    const saved = (await transaction.get(refs.backup)).data()
    if (!current || saved?.deletedAt) throw new Error('Không tìm thấy kỷ niệm')
    writeRevision(transaction, refs, uid, 'edit', { ...current, ...patch }, saved?.revision ? saved : current)
  })
}

export async function deleteMemoryWithBackup(id: string) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  await changeMemory(async (transaction) => {
    const current = (await transaction.get(refs.memory)).data()
    const saved = (await transaction.get(refs.backup)).data()
    if (!current || saved?.deletedAt) return
    writeRevision(transaction, refs, uid, 'delete', current, saved?.revision ? saved : current)
  })
}

export function recoverMemory(id: string, coupleId: string, mediaFallback?: DocumentData) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  return changeMemory(async (transaction) => {
    const current = (await transaction.get(refs.memory)).data()
    const saved = (await transaction.get(refs.backup)).data()
    if ((current && current.coupleId !== coupleId) || (saved && saved.coupleId !== coupleId)) return 'skipped'
    if (saved?.deletedAt) return 'deleted'

    if (current) {
      const isPlaceholder = current.title === 'Kỷ niệm đã khôi phục' && current.description === ''
      if (isPlaceholder && saved && (saved.description || saved.title !== current.title)) {
        writeRevision(transaction, refs, uid, 'recover', saved, saved.revision ? saved : current)
        return 'full'
      }
      if (!saved?.revision) writeRevision(transaction, refs, uid, 'baseline', current)
      return 'existing'
    }

    const data = saved ?? mediaFallback
    if (!data || data.coupleId !== coupleId) return 'skipped'
    writeRevision(transaction, refs, uid, 'recover', data, saved)
    return saved ? 'full' : 'media'
  })
}

export async function listMemoryVersions(id: string) {
  const { versions } = memoryRefs(id)
  const result = await getDocsFromServer(query(versions, orderBy('revision', 'desc')))
  return result.docs.map((entry) => ({ ...(entry.data() as MemoryVersion), id: entry.id }))
}

export async function restoreMemoryVersion(id: string, versionId: string) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  await changeMemory(async (transaction) => {
    const current = (await transaction.get(refs.memory)).data()
    const saved = (await transaction.get(refs.backup)).data()
    const version = (await transaction.get(doc(refs.versions, versionId))).data() as MemoryVersion | undefined
    if (!current || !saved || saved.deletedAt || !version) throw new Error('Không tìm thấy phiên bản')
    writeRevision(transaction, refs, uid, 'restoreVersion', {
      ...version.snapshot,
      createdAt: current.createdAt,
      createdBy: current.createdBy,
      coupleId: current.coupleId,
      updatedAt: serverTimestamp(),
    }, saved)
  })
}

export async function restoreDeletedMemory(id: string) {
  const uid = actorUid()
  const refs = memoryRefs(id)
  await changeMemory(async (transaction) => {
    const current = await transaction.get(refs.memory)
    const saved = (await transaction.get(refs.backup)).data() as Memory | undefined
    if (current.exists() || !saved?.deletedAt) return
    writeRevision(transaction, refs, uid, 'undelete', saved, saved)
  })
}
