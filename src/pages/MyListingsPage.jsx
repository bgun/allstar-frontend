import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const GRADE_COLORS = {
  A: 'bg-green-500',
  B: 'bg-green-400',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
}

const FAVORITES_KEY = 'allstar_favorites'

function loadFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favSet) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favSet]))
}

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function GradeBadge({ grade, score }) {
  return (
    <div className={`${GRADE_COLORS[grade] || 'bg-gray-500'} text-white rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-sm`}>
      <span className="text-lg font-bold leading-none">{grade}</span>
      <span className="text-xs opacity-90">{score}</span>
    </div>
  )
}

export default function MyListingsPage() {
  const [favorites, setFavorites] = useState(loadFavorites)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    loadFavoriteListings()
  }, [])

  async function loadFavoriteListings() {
    const favIds = [...favorites]
    if (favIds.length === 0) {
      setListings([])
      setLoading(false)
      return
    }

    // Fetch grades joined with listings for favorite listing IDs
    const { data: grades } = await supabase
      .from('grades')
      .select(`
        *,
        listing:listings(*)
      `)
      .in('listing_id', favIds)
      .order('score', { ascending: false })

    // Deduplicate by listing_id — keep the most recent grade per listing
    const seen = new Set()
    const deduped = (grades || []).filter((g) => {
      if (seen.has(g.listing_id)) return false
      seen.add(g.listing_id)
      return true
    })

    setListings(deduped)
    setLoading(false)
  }

  function removeFavorite(listingId) {
    setFavorites((prev) => {
      const next = new Set(prev)
      next.delete(listingId)
      saveFavorites(next)
      return next
    })
    setListings((prev) => prev.filter((g) => g.listing_id !== listingId))
  }

  const filteredListings = useMemo(() => {
    if (!filterText.trim()) return listings
    const lower = filterText.toLowerCase()
    return listings.filter((g) => g.listing?.title?.toLowerCase().includes(lower))
  }, [listings, filterText])

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading favorites...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">My Listings</h2>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        {listings.length} starred listing{listings.length !== 1 ? 's' : ''}
        {filterText.trim() && ` (${filteredListings.length} matching filter)`}
      </p>

      {listings.length > 0 && (
        <div className="flex items-center mb-4">
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by title..."
            className="px-3 py-1 text-xs border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
          />
        </div>
      )}

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No starred listings yet. Star listings on the Listings page to save them here.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredListings.map((gradeRow) => {
            const listing = gradeRow.listing
            if (!listing) return null

            return (
              <div
                key={gradeRow.id}
                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  {listing.image_urls?.[0] ? (
                    <img
                      src={listing.image_urls[0]}
                      alt={listing.title}
                      className="w-full h-36 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 rounded mb-2 flex items-center justify-center text-gray-400 text-xs">
                      No image
                    </div>
                  )}
                  <button
                    onClick={() => removeFavorite(listing.id)}
                    className="absolute top-1 left-1 p-1 rounded-full bg-black/30 hover:bg-black/50 transition-colors cursor-pointer"
                    title="Remove from favorites"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <div className="absolute top-1 right-1">
                    <GradeBadge grade={gradeRow.grade_letter} score={gradeRow.score} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    listing.source === 'ebay' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {listing.source === 'ebay' ? 'eBay' : 'CL'}
                  </span>
                  {listing.listing_date && (
                    <span className="text-[10px] text-gray-400">{timeAgo(listing.listing_date)}</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{listing.title}</h3>

                {gradeRow.flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {gradeRow.flags.slice(0, 3).map((flag, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{flag}</span>
                    ))}
                    {gradeRow.flags.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{gradeRow.flags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-1 flex items-center justify-between">
                  {listing.price_text && <p className="text-green-700 font-bold text-sm">{listing.price_text}</p>}
                  {listing.url && (
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-blue-600 text-white text-xs font-medium px-2.5 py-1 rounded hover:bg-blue-700"
                    >
                      Open on {listing.source === 'ebay' ? 'eBay' : 'Craigslist'}
                    </a>
                  )}
                </div>
                {listing.location && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{listing.location}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
