import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const DEFAULT_PREFERENCES = {
  category_id: '33710',
  condition_ids: ['3000', '7000'],
  excluded_keywords: ['parting out', 'whole car', 'complete vehicle'],
  buying_options: ['FIXED_PRICE', 'BEST_OFFER', 'AUCTION'],
  vehicle_year: '',
  vehicle_make: '',
  vehicle_model: '',
  sort: 'newlyListed',
  max_price: '',
  craigslist_city: 'newyork',
}

const CATEGORIES = [
  { id: '33710', label: 'Headlight Assemblies' },
  { id: '33717', label: 'Tail Lights' },
  { id: '33713', label: 'Fog Lights' },
  { id: '33709', label: 'Headlight & Tail Light Covers' },
  { id: '', label: 'All Categories' },
]

const CONDITIONS = [
  { id: '3000', label: 'Used' },
  { id: '7000', label: 'For Parts / Not Working' },
  { id: '2500', label: 'Refurbished' },
]

const BUYING_OPTIONS = [
  { id: 'FIXED_PRICE', label: 'Fixed Price' },
  { id: 'BEST_OFFER', label: 'Best Offer' },
  { id: 'AUCTION', label: 'Auction' },
]

const SORT_OPTIONS = [
  { value: 'newlyListed', label: 'Newly Listed' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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
        setLoading(false)
      })
  }, [user])

  const handleCheckbox = (field, value) => {
    setPrefs((prev) => {
      const arr = prev[field] || []
      return {
        ...prev,
        [field]: arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value],
      }
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    // Clean up empty strings to null for optional fields
    const toSave = {
      ...prefs,
      vehicle_year: prefs.vehicle_year || null,
      vehicle_make: prefs.vehicle_make || null,
      vehicle_model: prefs.vehicle_model || null,
      max_price: prefs.max_price || null,
    }

    const { error } = await supabase
      .from('profiles')
      .update({ search_preferences: toSave })
      .eq('id', user.id)

    setSaving(false)
    setMessage(error ? `Error: ${error.message}` : 'Settings saved!')
    if (!error) setTimeout(() => setMessage(''), 3000)
  }

  if (loading) {
    return <div className="text-gray-500">Loading settings...</div>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Search Settings</h2>
      <form onSubmit={handleSave} className="max-w-2xl space-y-6">

        {/* eBay Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">eBay Category</label>
          <select
            value={prefs.category_id}
            onChange={(e) => setPrefs({ ...prefs, category_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
          <div className="flex flex-wrap gap-4">
            {CONDITIONS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.condition_ids?.includes(c.id) || false}
                  onChange={() => handleCheckbox('condition_ids', c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Buying Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Buying Options</label>
          <div className="flex flex-wrap gap-4">
            {BUYING_OPTIONS.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prefs.buying_options?.includes(b.id) || false}
                  onChange={() => handleCheckbox('buying_options', b.id)}
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>

        {/* Excluded Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excluded Keywords</label>
          <input
            type="text"
            value={(prefs.excluded_keywords || []).join(', ')}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                excluded_keywords: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="parting out, whole car, complete vehicle"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-400 mt-1">Comma-separated. These terms will be excluded from eBay results.</p>
        </div>

        {/* Vehicle Fitment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Fitment (optional)</label>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={prefs.vehicle_year || ''}
              onChange={(e) => setPrefs({ ...prefs, vehicle_year: e.target.value })}
              placeholder="Year"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              value={prefs.vehicle_make || ''}
              onChange={(e) => setPrefs({ ...prefs, vehicle_make: e.target.value })}
              placeholder="Make"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="text"
              value={prefs.vehicle_model || ''}
              onChange={(e) => setPrefs({ ...prefs, vehicle_model: e.target.value })}
              placeholder="Model"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Max Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (USD)</label>
          <input
            type="number"
            value={prefs.max_price || ''}
            onChange={(e) => setPrefs({ ...prefs, max_price: e.target.value })}
            placeholder="No limit"
            min="0"
            className="w-40 px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={prefs.sort}
            onChange={(e) => setPrefs({ ...prefs, sort: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Craigslist City */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Craigslist City</label>
          <input
            type="text"
            value={prefs.craigslist_city || ''}
            onChange={(e) => setPrefs({ ...prefs, craigslist_city: e.target.value })}
            placeholder="newyork"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-400 mt-1">Subdomain used in craigslist URL (e.g. newyork, losangeles, chicago)</p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {message && (
            <span className={message.startsWith('Error') ? 'text-red-600 text-sm' : 'text-green-600 text-sm'}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
