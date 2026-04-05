interface Props {
  message: string
  detail?: string
}

export default function EmptyState({ message, detail }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-sm font-medium text-zinc-500">{message}</p>
      {detail && <p className="text-xs text-zinc-400">{detail}</p>}
    </div>
  )
}
