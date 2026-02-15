import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'

export function TrashPage() {
  const { user, signOut } = useAuth()
  const [listings, setListings] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTrashListings()
  }, [user])

  const fetchTrashListings = async () => {
    try {
      setIsLoading(true)

      // Fetch user actions with thumbs_down and join with listings
      const { data, error } = await supabase
        .from('user_listing_actions')
        .select(`
          *,
          listings (*)
        `)
        .eq('user_id', user.id)
        .eq('action', 'thumbs_down')
        .order('created_at', { ascending: false })

      if (error) throw error

      setListings(data || [])
    } catch (error) {
      console.error('Error fetching trash listings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemove = async (actionId) => {
    try {
      const { error } = await supabase
        .from('user_listing_actions')
        .delete()
        .eq('id', actionId)

      if (error) throw error

      setListings(prev => prev.filter(item => item.id !== actionId))
    } catch (error) {
      console.error('Error removing from trash:', error)
      alert('Failed to remove item. Please try again.')
    }
  }

  const formatPrice = (priceCents) => {
    if (!priceCents) return 'Price not listed'
    return `$${(priceCents / 100).toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Allstar AI</h1>
          <div className="flex items-center gap-4">
            <a
              href="/search"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Search
            </a>
            <a
              href="/saved"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Saved
            </a>
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={signOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Trash</h2>

        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        )}

        {!isLoading && listings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No items in trash</p>
            <p className="text-gray-500 mt-2">Thumbs-down listings will appear here</p>
          </div>
        )}

        {!isLoading && listings.length > 0 && (
          <div className="space-y-4">
            {listings.map(item => {
              const listing = item.listings
              return (
                <div key={item.id} className="bg-white rounded-lg shadow-md p-6 flex gap-4">
                  {/* Image */}
                  <div className="w-32 h-32 flex-shrink-0">
                    {listing.image_urls && listing.image_urls.length > 0 ? (
                      <img
                        src={listing.image_urls[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600"
                        >
                          {listing.title}
                        </a>
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                        listing.source === 'ebay' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {listing.source}
                      </span>
                    </div>

                    <p className="text-xl font-bold text-gray-900 mb-2">
                      {formatPrice(listing.price_cents)}
                    </p>

                    {listing.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {listing.location}</p>
                    )}

                    {listing.description && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                        {listing.description}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 mb-2">
                      Added to trash on {new Date(item.created_at).toLocaleDateString()}
                    </p>

                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove from trash
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
