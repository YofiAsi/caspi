interface Props {
  name: string
}

export default function CollectionBadge({ name }: Props) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <rect x="1" y="1" width="3.5" height="3.5" rx="0.5" />
        <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5" />
        <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.5" />
        <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.5" />
      </svg>
      {name}
    </span>
  )
}
