import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { Lock } from 'lucide-react'

export default function Login() {
  const { user, signInWithEmail, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const onEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      setBusy(true)
      if (!email || !password) {
        toast.error('Vui lòng nhập email và mật khẩu')
        return
      }
      await signInWithEmail(email, password)
      toast.success('Chào mừng bạn quay lại')
      navigate('/journal')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-[28px] border border-rose/15 bg-white/70 p-7 shadow-soft dark:border-white/10 dark:bg-white/5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl tracking-tight">
              {user ? 'Tài khoản' : 'Đăng nhập'}
            </h1>
            <p className="mt-2 text-sm text-muted dark:text-cream/70">
              Riêng tư cho hai người — ảnh, video, kỷ niệm theo dòng thời gian.
            </p>
          </div>
          <Link to="/" className="text-sm font-medium text-rose hover:underline">
            Trang chủ
          </Link>
        </div>

        {user ? (
          <div className="mt-6 rounded-2xl border border-rose/10 bg-cream/60 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-muted dark:text-cream/70">
              Bạn đang đăng nhập với:
            </p>
            <p className="mt-1 font-medium text-ink dark:text-cream">
              {user.displayName ?? user.email ?? user.uid}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/journal')}
                className="rounded-full bg-rose px-5 py-2.5 text-sm font-medium text-cream shadow-soft transition hover:brightness-95"
              >
                Vào nhật ký
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBusy(true)
                    await signOut()
                    toast.success('Đã đăng xuất')
                  } catch {
                    toast.error('Không thể đăng xuất')
                  } finally {
                    setBusy(false)
                  }
                }}
                disabled={busy}
                className="rounded-full border border-rose/25 bg-white/60 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onEmail} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted dark:text-cream/70">
                Email
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ban@vidu.com"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-rose/15 bg-white/80 px-4 py-3 text-sm outline-none ring-0 transition focus:border-rose/40 dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted dark:text-cream/70">
                Mật khẩu
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-rose/15 bg-white/80 px-4 py-3 text-sm outline-none ring-0 transition focus:border-rose/40 dark:border-white/10 dark:bg-white/5"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-60"
            >
              <Lock size={16} />
              {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <div className="mt-4 rounded-2xl border border-rose/10 bg-cream/40 p-3 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-xs text-muted dark:text-cream/60">
                🔒 Tài khoản do Quản trị viên cấp trực tiếp.
              </p>
            </div>

            <div className="flex justify-end">
              <Link to="/" className="text-sm text-muted hover:underline dark:text-cream/70">
                ← Quay về trang chủ
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  )
}
