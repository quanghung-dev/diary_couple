import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { db } from '../../lib/firebase'
import { restoreDeletedMemory } from '../../lib/memoryBackup'
import type { Memory } from '../../types'

export function MemoryTrash({ coupleId }: { coupleId: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<(Memory & { id: string })[]>([])
  const [status, setStatus] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStatus('Đang tải thùng rác…')
    return onSnapshot(
      query(collection(db, 'memoryBackups'), where('coupleId', '==', coupleId)),
      (snapshot) => {
        const deleted = snapshot.docs
          .map((entry) => ({ ...(entry.data() as Memory), id: entry.id }))
          .filter((entry) => entry.deletedAt != null)
          .sort((a, b) => b.deletedAt!.toMillis() - a.deletedAt!.toMillis())
        setItems(deleted)
        setStatus(deleted.length ? '' : 'Thùng rác trống.')
      },
      (error) => {
        console.error(error)
        setStatus('Không tải được thùng rác.')
      },
    )
  }, [open, coupleId])

  async function restore(id: string) {
    setRestoring(id)
    try {
      await restoreDeletedMemory(id)
      toast.success('Đã đưa bài về Nhật ký')
    } catch (error) {
      console.error(error)
      toast.error('Không thể khôi phục bài đã xóa')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <details className="mt-6 rounded-[28px] border border-rose/15 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5"
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-serif text-2xl">Thùng rác</summary>
      {open && (
        <>
          <p className="mt-3 text-sm" role="status">{status}</p>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose/15 p-4 dark:border-white/10">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted dark:text-cream/70">
                    Đã xóa {item.deletedAt?.toDate().toLocaleString('vi-VN')}
                  </p>
                </div>
                <button type="button" disabled={restoring != null} onClick={() => restore(item.id)}
                  className="text-sm font-medium text-rose disabled:opacity-60">
                  {restoring === item.id ? 'Đang khôi phục…' : 'Khôi phục'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
