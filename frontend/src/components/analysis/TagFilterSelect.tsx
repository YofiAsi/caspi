import * as Select from '@radix-ui/react-select'
import type { TagItem } from '../../types'

interface Props {
  tags: TagItem[]
  value: string | null
  onChange: (tagId: string | null) => void
  id?: string
}

export function TagFilterSelect({ tags, value, onChange, id }: Props) {
  const v = value ?? '__all__'
  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        Tag
      </label>
      <Select.Root
        value={v}
        onValueChange={(next) => onChange(next === '__all__' ? null : next)}
      >
        <Select.Trigger
          id={id}
          className="inline-flex items-center justify-between gap-2 w-full h-10 px-3 text-sm border border-border rounded-lg bg-input-bg text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Select.Value placeholder="All payments" />
          <Select.Icon className="text-fg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg z-[100]"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1 max-h-[280px]">
              <Select.Item
                value="__all__"
                className="text-sm px-3 py-2 rounded-md cursor-pointer outline-none data-highlighted:bg-hover-surface text-fg"
              >
                <Select.ItemText>All payments</Select.ItemText>
              </Select.Item>
              {tags.map((t) => (
                <Select.Item
                  key={t.id}
                  value={t.id}
                  className="text-sm px-3 py-2 rounded-md cursor-pointer outline-none data-highlighted:bg-hover-surface text-fg"
                >
                  <Select.ItemText>{t.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
