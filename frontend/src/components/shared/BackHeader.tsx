import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
}

export default function BackHeader({ title }: Props) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
        aria-label="Go back"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 4l-6 6 6 6" />
        </svg>
      </button>
      <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
    </header>
  )
}
