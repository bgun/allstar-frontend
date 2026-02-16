import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const DEFAULT_PREFERENCES = {
  category_id: '33710',
  condition_ids: ['3000'],
  excluded_keywords: ['parting out', 'whole car', 'complete vehicle'],
  buying_options: ['FIXED_PRICE', 'BEST_OFFER', 'AUCTION'],
  vehicle_year: '',
  vehicle_make: '',
  vehicle_model: '',
  sort: 'newlyListed',
  max_price: '500',
  brand_type_oem: true,
  origin_us: true,
  craigslist_enabled: true,
  craigslist_city: 'denver',
  craigslist_lat: '39.6654',
  craigslist_lon: '-105.1062',
  craigslist_distance: '1000',
}

const SORT_OPTIONS = [
  { value: 'newlyListed', label: 'Newest' },
  { value: 'price', label: 'Price ↑' },
  { value: '-price', label: 'Price ↓' },
]

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

function loadSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem('searchHistory') || '[]')
  } catch {
    return []
  }
}

function saveSearchHistory(query) {
  const history = loadSearchHistory().filter((h) => h.query !== query)
  history.unshift({ query, timestamp: Date.now() })
  localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 20)))
}

export default function SearchPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sources, setSources] = useState(null)
  const [filtered, setFiltered] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const historyRef = useRef(null)
  const inputRef = useRef(null)

  // Load preferences from Supabase
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('search_preferences')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.search_preferences) {
          setPrefs({ ...DEFAULT_PREFERENCES, ...data.search_preferences })
        }
        setPrefsLoaded(true)
      })
  }, [user])

  // Close history dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const savePrefs = async () => {
    if (!user) return
    const toSave = {
      ...prefs,
      vehicle_year: prefs.vehicle_year || null,
      vehicle_make: prefs.vehicle_make || null,
      vehicle_model: prefs.vehicle_model || null,
      max_price: prefs.max_price || null,
    }
    await supabase
      .from('profiles')
      .update({ search_preferences: toSave })
      .eq('id', user.id)
  }

  const doSearch = async (searchQuery) => {
    const q = searchQuery || query
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSources(null)
    setFiltered(null)
    setShowHistory(false)

    // Save prefs and search history
    savePrefs()
    saveSearchHistory(q.trim())

    try {
      const params = new URLSearchParams({ q })
      if (user?.id) params.set('user_id', user.id)
      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || [])
      setSources(data.sources || null)
      setFiltered(data.filtered || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    doSearch()
  }

  const handleHistoryClick = (historyQuery) => {
    setQuery(historyQuery)
    setShowHistory(false)
    doSearch(historyQuery)
  }

  const history = loadSearchHistory()
  const clEnabled = prefs.craigslist_enabled !== false

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Search Listings</h2>

      {/* Settings toggle */}
      <button
        type="button"
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="text-xs text-gray-500 hover:text-gray-700 mb-2 cursor-pointer flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Settings
      </button>

      {/* Inline settings */}
      {settingsOpen && prefsLoaded && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 space-y-2">
          {/* Row 1: eBay filters + Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={prefs.brand_type_oem !== false}
                onChange={(e) => setPrefs({ ...prefs, brand_type_oem: e.target.checked })}
                className="w-3 h-3"
              />
              OEM Only
            </label>

            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={prefs.origin_us !== false}
                onChange={(e) => setPrefs({ ...prefs, origin_us: e.target.checked })}
                className="w-3 h-3"
              />
              US Origin
            </label>

            <label className="text-xs text-gray-500">
              Max $
              <input
                type="number"
                value={prefs.max_price || ''}
                onChange={(e) => setPrefs({ ...prefs, max_price: e.target.value })}
                placeholder="500"
                min="0"
                className="ml-1 w-16 text-xs px-1 py-0.5 border border-gray-300 rounded"
              />
            </label>

            <label className="text-xs text-gray-500">
              Sort
              <select
                value={prefs.sort}
                onChange={(e) => setPrefs({ ...prefs, sort: e.target.value })}
                className="ml-1 text-xs px-1 py-0.5 border border-gray-300 rounded"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Row 2: Vehicle, Craigslist, CL City, Radius */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Vehicle:</span>
              <input
                type="text"
                value={prefs.vehicle_year || ''}
                onChange={(e) => setPrefs({ ...prefs, vehicle_year: e.target.value })}
                placeholder="Year"
                className="w-14 text-xs px-1 py-0.5 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={prefs.vehicle_make || ''}
                onChange={(e) => setPrefs({ ...prefs, vehicle_make: e.target.value })}
                placeholder="Make"
                className="w-16 text-xs px-1 py-0.5 border border-gray-300 rounded"
              />
              <input
                type="text"
                value={prefs.vehicle_model || ''}
                onChange={(e) => setPrefs({ ...prefs, vehicle_model: e.target.value })}
                placeholder="Model"
                className="w-16 text-xs px-1 py-0.5 border border-gray-300 rounded"
              />
            </div>

            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={clEnabled}
                onChange={(e) => setPrefs({ ...prefs, craigslist_enabled: e.target.checked })}
                className="w-3 h-3"
              />
              Craigslist
            </label>

            <label className={`text-xs ${clEnabled ? 'text-gray-500' : 'text-gray-300'}`}>
              CL City
              <input
                type="text"
                value={prefs.craigslist_city || ''}
                onChange={(e) => setPrefs({ ...prefs, craigslist_city: e.target.value })}
                placeholder="denver"
                disabled={!clEnabled}
                className="ml-1 w-20 text-xs px-1 py-0.5 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-300"
              />
            </label>

            <label className={`text-xs ${clEnabled ? 'text-gray-500' : 'text-gray-300'}`}>
              Radius (mi)
              <input
                type="number"
                value={prefs.craigslist_distance || ''}
                onChange={(e) => setPrefs({ ...prefs, craigslist_distance: e.target.value })}
                placeholder="1000"
                min="0"
                disabled={!clEnabled}
                className="ml-1 w-16 text-xs px-1 py-0.5 border border-gray-300 rounded disabled:bg-gray-100 disabled:text-gray-300"
              />
            </label>
          </div>
        </div>
      )}

      {/* Search bar with history dropdown */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <div className="relative flex-1" ref={historyRef}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            placeholder="Search eBay and Craigslist..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          />
          {showHistory && history.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleHistoryClick(h.query)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                >
                  <span>{h.query}</span>
                  <span className="text-xs text-gray-400">{timeAgo(h.timestamp)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
          {filtered && (
            <span>Showing {filtered.kept} of {filtered.original} results</span>
          )}
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

      {/* Debug URL bubble - fixed bottom right */}
      {sources && (
        <div className="fixed bottom-4 right-4 z-50">
          {debugOpen ? (
            <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-96 max-h-64 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-700">Search URLs</span>
                <button
                  onClick={() => setDebugOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer text-sm"
                >
                  x
                </button>
              </div>
              {sources.ebay?.url && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-blue-600">eBay API:</span>
                  <p className="text-xs text-gray-500 break-all mt-0.5">{sources.ebay.url}</p>
                </div>
              )}
              {sources.craigslist?.url && (
                <div>
                  <span className="text-xs font-medium text-purple-600">Craigslist:</span>
                  <p className="text-xs text-gray-500 break-all mt-0.5">{sources.craigslist.url}</p>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setDebugOpen(true)}
              className="bg-gray-800 text-white text-xs px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 cursor-pointer"
              title="Show search URLs"
            >
              URLs
            </button>
          )}
        </div>
      )}
    </div>
  )
}
