import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '../../api/tags'
import { expensesApi } from '../../api/expenses'
import { merchantsApi } from '../../api/merchants'
import { collectionsApi } from '../../api/collections'
import type { TagOut, CollectionBrief, MerchantBrief } from '../../api/types'
import BottomSheet from '../shared/BottomSheet'
import TagChip from '../shared/TagChip'
import SearchBar from '../shared/SearchBar'

type TagScope = 'expense' | 'merchant'

interface Props {
  expenseIds: string[]
  merchant: MerchantBrief | null
  existingTags: TagOut[]
  existingCollection: CollectionBrief | null
  onClose: () => void
  onSaved: () => void
}

export default function TaggingSheet({
  expenseIds,
  merchant,
  existingTags,
  existingCollection,
  onClose,
  onSaved,
}: Props) {
  const queryClient = useQueryClient()
  const isBulk = expenseIds.length > 1

  const [search, setSearch] = useState('')
  const [pendingTags, setPendingTags] = useState<TagOut[]>([])
  const [tagScopes, setTagScopes] = useState<Record<string, TagScope>>({})
  const [selectedCollection, setSelectedCollection] = useState<CollectionBrief | null>(existingCollection)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)
  const [collectionSearch, setCollectionSearch] = useState('')

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  })

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.list(),
    enabled: showCollectionPicker,
  })

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter(t => t.name.toLowerCase().includes(q))
  }, [allTags, search])

  const existingTagIds = new Set(existingTags.map(t => t.id))
  const pendingTagIds = new Set(pendingTags.map(t => t.id))
  const showCreate = search.trim() && !allTags.some(t => t.name.toLowerCase() === search.trim().toLowerCase())

  const filteredCollections = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase()
    if (!q) return collections
    return collections.filter(c => c.name.toLowerCase().includes(q))
  }, [collections, collectionSearch])

  function toggleTag(tag: TagOut) {
    if (existingTagIds.has(tag.id)) return // already saved, can't un-add here
    setPendingTags(prev =>
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    )
    if (!tagScopes[tag.id]) {
      setTagScopes(prev => ({ ...prev, [tag.id]: 'expense' }))
    }
  }

  function setScope(tagId: string, scope: TagScope) {
    setTagScopes(prev => ({ ...prev, [tagId]: scope }))
  }

  const createTagMutation = useMutation({
    mutationFn: (name: string) => tagsApi.create(name),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setPendingTags(prev => [...prev, tag])
      setTagScopes(prev => ({ ...prev, [tag.id]: 'expense' }))
      setSearch('')
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const expenseTagIds = [
        ...existingTagIds,
        ...pendingTags.filter(t => tagScopes[t.id] === 'expense').map(t => t.id),
      ]
      const merchantTagIds = pendingTags.filter(t => tagScopes[t.id] === 'merchant').map(t => t.id)

      await Promise.all([
        // Update expense tags + collection for all selected expenses
        ...expenseIds.map(id =>
          expensesApi.update(id, {
            tag_ids: expenseTagIds,
            collection_id: selectedCollection?.id ?? null,
          })
        ),
        // Update merchant tags if any
        merchant && merchantTagIds.length > 0
          ? merchantsApi.get(merchant.id).then(m => {
              const currentMerchantTagIds = m.tags.map(t => t.id)
              const merged = Array.from(new Set([...currentMerchantTagIds, ...merchantTagIds]))
              return merchantsApi.update(merchant.id, { tag_ids: merged })
            })
          : Promise.resolve(),
      ])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['merchants'] })
      onSaved()
    },
  })

  const merchantName = merchant?.alias ?? merchant?.canonical_name

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isBulk ? `Tag ${expenseIds.length} expenses` : 'Tag expense'}
    >
      <div className="flex flex-col gap-4 px-4 pb-4">
        {/* Context line */}
        {!isBulk && merchantName && (
          <p className="text-sm text-zinc-500">
            From <span className="font-medium text-zinc-800">{merchantName}</span>
          </p>
        )}

        {/* Existing tags (read-only) */}
        {existingTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {existingTags.map(t => (
              <TagChip key={t.id} name={t.name} />
            ))}
          </div>
        )}

        {/* Tag search */}
        <SearchBar value={search} onChange={setSearch} placeholder="Search or create tag…" />

        {/* Tag results */}
        <div className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white overflow-hidden">
          {showCreate && (
            <button
              type="button"
              onClick={() => createTagMutation.mutate(search.trim())}
              disabled={createTagMutation.isPending}
              className="flex items-center gap-2 px-4 py-3 text-left text-sm active:bg-zinc-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-bold">+</span>
              Create <span className="font-medium">"{search.trim()}"</span>
            </button>
          )}

          {filteredTags.map(tag => {
            const isPending = pendingTagIds.has(tag.id)
            const isExisting = existingTagIds.has(tag.id)
            const scope = tagScopes[tag.id] ?? 'expense'

            return (
              <div key={tag.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  disabled={isExisting}
                  className={`flex items-center justify-between px-4 py-3 text-left text-sm active:bg-zinc-50 ${
                    isExisting ? 'opacity-40' : ''
                  }`}
                >
                  <span className={isPending || isExisting ? 'font-medium text-zinc-900' : 'text-zinc-700'}>
                    {tag.name}
                  </span>
                  {(isPending || isExisting) && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-800">
                      <path d="M2 8l4 4 8-8" />
                    </svg>
                  )}
                </button>

                {/* Scope toggle — shown only when pending and single-expense or all same merchant */}
                {isPending && !isBulk && merchant && (
                  <div className="flex gap-1 px-4 pb-3">
                    <button
                      type="button"
                      onClick={() => setScope(tag.id, 'expense')}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                        scope === 'expense'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      This expense only
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope(tag.id, 'merchant')}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                        scope === 'merchant'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      All from {merchantName}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {filteredTags.length === 0 && !showCreate && (
            <p className="px-4 py-3 text-sm text-zinc-400">No tags found</p>
          )}
        </div>

        {/* Collection section */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Collection</p>
          {!showCollectionPicker ? (
            <button
              type="button"
              onClick={() => setShowCollectionPicker(true)}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-100 bg-white px-4 py-3 text-sm active:bg-zinc-50"
            >
              <span className={selectedCollection ? 'font-medium text-zinc-900' : 'text-zinc-400'}>
                {selectedCollection?.name ?? 'No collection'}
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <SearchBar value={collectionSearch} onChange={setCollectionSearch} placeholder="Search collections…" />
              <div className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-100 bg-white overflow-hidden max-h-44">
                <button
                  type="button"
                  onClick={() => { setSelectedCollection(null); setShowCollectionPicker(false) }}
                  className="px-4 py-3 text-left text-sm text-zinc-400 active:bg-zinc-50"
                >
                  No collection
                </button>
                {filteredCollections.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCollection(c); setShowCollectionPicker(false) }}
                    className="flex items-center justify-between px-4 py-3 text-left text-sm active:bg-zinc-50"
                  >
                    <span className="text-zinc-800">{c.name}</span>
                    {selectedCollection?.id === c.id && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 8l4 4 8-8" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || (pendingTags.length === 0 && selectedCollection?.id === existingCollection?.id)}
          className="w-full rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white disabled:opacity-40 active:bg-zinc-700"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>

        {saveMutation.isError && (
          <p className="text-center text-xs text-red-500">Something went wrong. Please try again.</p>
        )}
      </div>
    </BottomSheet>
  )
}
