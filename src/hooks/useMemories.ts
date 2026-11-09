import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { db } from '../lib/firebase'
import type { Memory } from '../types'
import { serverNow } from '../lib/firestore'
import { deleteMemoryWithBackup, saveNewMemory, updateMemoryWithBackup } from '../lib/memoryBackup'

export async function createMemory(params: {
  memoryId: string
  data: Omit<Memory, 'createdAt' | 'updatedAt'> & {
    createdAt: any
    updatedAt: any
  }
}) {
  const { memoryId, data } = params
  await saveNewMemory(memoryId, data)
}

export function useMemories(params: { coupleId: string; pageSize?: number }) {
  const { coupleId, pageSize = 10 } = params
  const [memories, setMemories] = useState<(Memory & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  useEffect(() => {
    if (!coupleId) {
      setMemories([])
      setLoading(false)
      setHasMore(false)
      lastDocRef.current = null
      return
    }
    setLoading(true)
    lastDocRef.current = null
    setHasMore(true)

    let unsubFallback: null | (() => void) = null

    const q = query(
      collection(db, 'memories'),
      where('coupleId', '==', coupleId),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    )

    const unsubPrimary = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
        lastDocRef.current = docs.length ? docs[docs.length - 1]! : null
        setHasMore(docs.length === pageSize)
        setMemories(docs.map((d) => ({
          ...(d.data({ serverTimestamps: 'estimate' }) as Memory),
          id: d.id,
        })))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        const msg = String((err as any)?.message ?? '')
        const code = String((err as any)?.code ?? '')
        if (
          code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index')
        ) {
          // Stop the failing indexed listener to avoid repeated console spam.
          try {
            unsubPrimary()
          } catch {
            // ignore
          }

          // Read the full set before sorting when the composite index is unavailable.
          const q2 = query(
            collection(db, 'memories'),
            where('coupleId', '==', coupleId),
          )
          unsubFallback = onSnapshot(
            q2,
            (snap2) => {
              const docs2 = snap2.docs
              lastDocRef.current = null
              setHasMore(false)
              const sorted = docs2
                .map((d) => ({
                  ...(d.data({ serverTimestamps: 'estimate' }) as Memory),
                  id: d.id,
                }))
                .sort(
                  (a, b) =>
                    (b.createdAt ?? b.date).toMillis() - (a.createdAt ?? a.date).toMillis(),
                )
              setMemories(sorted)
              setLoading(false)
            },
            (err2) => {
              console.error(err2)
              setLoading(false)
            },
          )
          return
        }

        setLoading(false)
      },
    )

    return () => {
      unsubPrimary()
      unsubFallback?.()
    }
  }, [coupleId, pageSize])

  const loadMore = useCallback(async () => {
    if (!coupleId) return
    if (!hasMore) return
    if (!lastDocRef.current) return

    try {
      setLoadingMore(true)
      const q = query(
        collection(db, 'memories'),
        where('coupleId', '==', coupleId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(pageSize),
      )
      const snap = await getDocs(q)
      const docs = snap.docs
      lastDocRef.current = docs.length ? docs[docs.length - 1]! : lastDocRef.current
      setHasMore(docs.length === pageSize)
      setMemories((prev) => [
        ...prev,
        ...docs.map((d) => ({ ...(d.data() as Memory), id: d.id })),
      ])
    } catch (e) {
      console.error(e)
      toast.error('Không thể tải thêm')
    } finally {
      setLoadingMore(false)
    }
  }, [coupleId, hasMore, pageSize])

  const deleteMemory = useCallback(async (id: string) => {
    try {
      await deleteMemoryWithBackup(id)
      toast.success('Đã xoá kỷ niệm')
    } catch (e) {
      console.error(e)
      toast.error('Không thể xoá')
    }
  }, [])

  const updateMemory = useCallback(
    async (id: string, patch: Partial<Memory>) => {
      try {
        await updateMemoryWithBackup(id, {
          ...patch,
          updatedAt: serverNow(),
        })
        toast.success('Đã cập nhật')
      } catch (e) {
        console.error(e)
        toast.error('Không thể cập nhật')
      }
    },
    [],
  )

  return useMemo(
    () => ({
      memories,
      loading,
      loadingMore,
      hasMore,
      loadMore,
      deleteMemory,
      updateMemory,
    }),
    [
      memories,
      loading,
      loadingMore,
      hasMore,
      loadMore,
      deleteMemory,
      updateMemory,
    ],
  )
}

export function useMemory(id: string) {
  const [memory, setMemory] = useState<(Memory & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setMemory(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const ref = doc(db, 'memories', id)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setMemory(null)
          setLoading(false)
          return
        }
        setMemory({ ...(snap.data() as Memory), id: snap.id })
        setLoading(false)
      },
      () => setLoading(false),
    )
    return () => unsub()
  }, [id])

  const refresh = useCallback(async () => {
    const ref = doc(db, 'memories', id)
    const snap = await getDoc(ref)
    if (snap.exists()) setMemory({ ...(snap.data() as Memory), id: snap.id })
  }, [id])

  return { memory, loading, refresh }
}

