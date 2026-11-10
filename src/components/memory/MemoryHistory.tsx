import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { listMemoryVersions, restoreMemoryVersion } from '../../lib/memoryBackup'
import type { MemoryVersion } from '../../types'

const actionLabels: Record<MemoryVersion['action'], string> = {
  create: 'Tạo bài',
  edit: 'Chỉnh sửa',
  delete: 'Chuyển vào thùng rác',
  undelete: 'Khôi phục từ thùng rác',
  recover: 'Khôi phục từ bản sao',
  baseline: 'Bản lưu ban đầu',
  restoreVersion: 'Khôi phục phiên bản',
}

export function MemoryHistory({ id, revision }: { id: string; revision?: number }) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof listMemoryVersions>>>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !revision) return
    let active = true
    setStatus('Đang tải lịch sử…')
    listMemoryVersions(id).then((items) => {
      if (!active) return
      setVersions(items)
      setStatus(items.length ? '' : 'Chưa có phiên bản nào.')
    }).catch((error) => {
      if (!active) return
      console.error(error)
      setStatus('Không tải được lịch sử phiên bản.')
    })
    return () => { active = false }
  }, [id, open, revision])

  async function restore(versionId: string) {
    if (!window.confirm('Dùng nội dung của phiên bản này cho bài hiện tại? Thao tác sẽ tạo phiên bản mới.')) return
    setBusy(true)
    try {
      await restoreMemoryVersion(id, versionId)
      toast.success('Đã tạo phiên bản mới từ nội dung đã chọn')
    } catch (error) {
      console.error(error)
      toast.error('Không thể khôi phục phiên bản')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="mt-6 rounded-[28px] border border-rose/15 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5"
      onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-serif text-xl">Lịch sử phiên bản</summary>
      {open && (
        <>
          <p className="mt-3 text-sm" role="status">
            {revision ? status : 'Lịch sử của bài cũ bắt đầu khi bài được lưu vào kho phiên bản.'}
          </p>
          <ol className="mt-3 space-y-3">
            {versions.map((version) => (
              <li key={version.id} className="rounded-2xl border border-rose/15 p-4 dark:border-white/10">
                <p className="text-xs text-muted dark:text-cream/70">
                  Phiên bản {version.revision} · {actionLabels[version.action]} · {version.recordedAt.toDate().toLocaleString('vi-VN')}
                </p>
                <p className="mt-1 font-medium">{version.snapshot.title}</p>
                <p className="whitespace-pre-wrap text-sm">{version.snapshot.description}</p>
                {version.revision !== revision && (
                  <button type="button" disabled={busy} onClick={() => restore(version.id)}
                    className="mt-2 text-sm font-medium text-rose disabled:opacity-60">
                    Dùng phiên bản này
                  </button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  )
}
