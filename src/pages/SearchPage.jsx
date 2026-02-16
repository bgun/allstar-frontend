import { useState } from 'react'

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

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sources, setSources] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSources(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || [])
      setSources(data.sources || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Search Listings</h2>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search eBay and Craigslist..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {sources && (
        <div className="flex gap-4 mb-6 text-sm text-gray-500">
          <span>
            eBay: {sources.ebay.count} results
            {sources.ebay.status === 'rejected' && ' (failed)'}
          </span>
          <span>
            Craigslist: {sources.craigslist.count} results
            {sources.craigslist.status === 'rejected' && ' (failed)'}
          </span>
        </div>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((item, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-48 object-cover rounded mb-3"
                />
              )}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.source === 'ebay'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {item.source === 'ebay' ? 'eBay' : 'Craigslist'}
                </span>
                {item.listing_date && (
                  <span className="text-xs text-gray-400">{timeAgo(item.listing_date)}</span>
                )}
                {item.condition && (
                  <span className="text-xs text-gray-400">{item.condition}</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{item.title}</h3>
              <div className="mt-auto pt-2 flex items-center justify-between">
                {item.price && <p className="text-green-700 font-bold">{item.price}</p>}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline"
                  >
                    View listing
                  </a>
                )}
              </div>
              {item.location && (
                <p className="text-xs text-gray-400 mt-1">{item.location}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <p className="text-gray-500 text-center">Search for items across eBay and Craigslist to get started.</p>
      )}
    </div>
  )
}
