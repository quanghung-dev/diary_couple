import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, HeartHandshake } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCouple } from '../hooks/useCouple'
import { formatViFullDate } from '../lib/utils'

function Avatar({
  label,
  photoURL,
}: {
  label: string
  photoURL?: string | null
}) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={label}
        className="h-12 w-12 rounded-full border border-rose/20 object-cover"
      />
    )
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-full border border-rose/20 bg-rose-light/60 font-serif text-lg text-ink dark:border-white/10 dark:bg-white/5 dark:text-cream">
      {label.trim().slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { couple, loading, memoriesCount, createInviteLink, acceptInvite, setStartDate } =
    useCouple()
  const [params, setParams] = useSearchParams()
  const inviteToken = params.get('invite') ?? ''
  const [inviteLink, setInviteLink] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    ;(async () => {
      try {
        setBusy(true)
        await acceptInvite(inviteToken)
        toast.success('Đã ghép đôi thành công')
        params.delete('invite')
        setParams(params, { replace: true })
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Không thể ghép đôi')
      } finally {
        setBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  const anniversaryText = useMemo(() => {
    if (!couple?.startDate) return ''
    return formatViFullDate(couple.startDate)
  }, [couple?.startDate])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Cài đặt</h1>
          <p className="mt-2 text-muted dark:text-cream/70">
            Ghép đôi, kỷ niệm ngày yêu, và quản lý tài khoản.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Cặp đôi</h2>
            <HeartHandshake className="text-rose" size={20} />
          </div>

          {loading ? (
            <div className="mt-6 h-24 animate-pulse rounded-2xl bg-rose-light/50 dark:bg-white/5" />
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3">
                <Avatar label={user?.displayName ?? user?.email ?? 'Bạn'} photoURL={user?.photoURL} />
                <div className="text-muted dark:text-cream/70">+</div>
                <Avatar label={couple?.user2 ? 'Partner' : '?'} photoURL={null} />
                <div className="ml-2">
                  <p className="text-sm text-muted dark:text-cream/70">
                    Couple ID
                  </p>
                  <p className="font-mono text-sm">{couple?.id ?? '—'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-rose/10 bg-cream/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-muted dark:text-cream/70">Kỷ niệm</span>
                  <span className="font-medium">
                    {memoriesCount == null ? '—' : memoriesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-rose/10 bg-cream/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-muted dark:text-cream/70">Ngày bắt đầu</span>
                  <span className="font-medium">{anniversaryText || '—'}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <input
                  type="date"
                  className="rounded-full border border-rose/20 bg-white/70 px-4 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  onChange={async (e) => {
                    if (!e.target.value) return
                    try {
                      setBusy(true)
                      await setStartDate(new Date(e.target.value))
                      toast.success('Đã cập nhật ngày kỷ niệm')
                    } catch {
                      toast.error('Không thể cập nhật')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  disabled={busy}
                />
              </div>
            </>
          )}
        </section>

        <section className="rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
          <h2 className="font-serif text-2xl">Ghép đôi</h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Nếu bạn chưa có người thương ở đây, hãy tạo link mời và gửi riêng tư.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              disabled={busy || loading || !couple || Boolean(couple.user2)}
              onClick={async () => {
                try {
                  setBusy(true)
                  const link = await createInviteLink()
                  setInviteLink(link)
                  await navigator.clipboard.writeText(link)
                  toast.success('Đã sao chép link mời')
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Không thể tạo link mời')
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-60"
            >
              {couple?.user2 ? 'Đã ghép đôi' : 'Tạo link mời'}
            </button>

            {inviteLink ? (
              <div className="flex items-center gap-2 rounded-2xl border border-rose/10 bg-cream/60 p-3 dark:border-white/10 dark:bg-white/5">
                <input
                  value={inviteLink}
                  readOnly
                  className="w-full bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose/15 bg-white/60 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink)
                      toast.success('Đã sao chép')
                    } catch {
                      toast.error('Không thể sao chép')
                    }
                  }}
                  aria-label="Copy invite link"
                >
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <RecoverySection coupleId={loading ? undefined : couple?.id} />
    </main>
  )
}

function RecoverySection({ coupleId }: { coupleId?: string }) {
  const [restoring, setRestoring] = useState(false)
  const [status, setStatus] = useState('')

  const handleRestore = async () => {
    if (!coupleId || restoring) return
    setRestoring(true)
    setStatus('Đang tìm và khôi phục kỷ niệm trên đám mây…')

    try {
      const { restoreMemories } = await import('../lib/recovery')
      const { full, media, cloudAvailable } = await restoreMemories(coupleId)
      const messages = []
      if (full) messages.push(`Đã khôi phục ${full} bài từ bản sao đầy đủ.`)
      if (media) messages.push(`Đã dựng lại ${media} bài từ ảnh và video. Các bài này thiếu tiêu đề và mô tả gốc.`)
      if (!cloudAvailable) messages.push('Không thể kiểm tra ảnh và video cũ trên Cloudinary. Vui lòng thử lại sau.')
      if (!messages.length) messages.push('Không tìm thấy bài viết nào cần khôi phục.')
      setStatus(messages.join(' '))
    } catch (error) {
      console.error(error)
      const denied = error instanceof Error && 'code' in error && error.code === 'permission-denied'
      setStatus(denied
        ? 'Firestore từ chối truy cập dữ liệu khôi phục. Quản trị viên cần kiểm tra quyền truy cập và Firestore Rules.'
        : 'Khôi phục chưa hoàn tất. Bạn có thể bấm lại để tiếp tục.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <section className="mt-8 rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">Khôi phục bài viết kỷ niệm</h2>
          <p className="mt-1 text-sm text-muted dark:text-cream/70">
            Tìm bản sao lưu của nhật ký theo tài khoản đang đăng nhập.
          </p>
        </div>
        <button
          type="button"
          disabled={restoring || !coupleId}
          onClick={handleRestore}
          className="rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-60"
        >
          {restoring ? 'Đang khôi phục…' : 'Khôi phục'}
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-muted dark:text-cream/70">
        {status}
      </p>
    </section>
  )
}
