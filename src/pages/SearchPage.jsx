import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SearchBar } from '../components/search/SearchBar'
import { ListingCard } from '../components/listings/ListingCard'
import { supabase } from '../lib/supabaseClient'

export function SearchPage() {
  const { user, signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [listings, setListings] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (searchQuery) => {
    setIsLoading(true)
    setQuery(searchQuery)
    setHasSearched(true)

    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: searchQuery })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setListings(data.listings)
    } catch (error) {
      console.error('Search error:', error)
      alert('Failed to search. Make sure the server is running (npm run server)')
      setListings([])
    } finally {
      setIsLoading(false)
    }
  }

  const saveListingToDb = async (listing) => {
    // First, ensure the listing exists in the database
    const { error: listingError } = await supabase
      .from('listings')
      .upsert({
        id: listing.id,
        url: listing.url,
        source: listing.source,
        title: listing.title,
        description: listing.description,
        price_cents: listing.price_cents,
        price_text: listing.price_text,
        location: listing.location,
        seller_name: listing.seller_name,
        seller_rating: listing.seller_rating,
        image_urls: listing.image_urls
      }, {
        onConflict: 'url'
      })

    if (listingError) throw listingError
  }

  const handleThumbsUp = async (listing) => {
    try {
      // Save listing to database first
      await saveListingToDb(listing)

      // Then save the user action
      const { error } = await supabase
        .from('user_listing_actions')
        .upsert({
          user_id: user.id,
          listing_id: listing.id,
          action: 'thumbs_up',
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Remove from current view
      setListings(prev => prev.filter(l => l.id !== listing.id))
    } catch (error) {
      console.error('Error saving thumbs up:', error)
      alert('Failed to save. Please try again.')
    }
  }

  const handleThumbsDown = async (listing) => {
    try {
      // Save listing to database first
      await saveListingToDb(listing)

      // Then save the user action
      const { error } = await supabase
        .from('user_listing_actions')
        .upsert({
          user_id: user.id,
          listing_id: listing.id,
          action: 'thumbs_down',
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Remove from current view
      setListings(prev => prev.filter(l => l.id !== listing.id))
    } catch (error) {
      console.error('Error saving thumbs down:', error)
      alert('Failed to save. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Allstar AI</h1>
          <div className="flex items-center gap-4">
            <a
              href="/saved"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Saved
            </a>
            <a
              href="/trash"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Trash
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
        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Search Results */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Searching for headlights...</p>
          </div>
        )}

        {!isLoading && hasSearched && listings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">No listings found for "{query}"</p>
            <p className="text-gray-500 mt-2">Try a different search term</p>
          </div>
        )}

        {!isLoading && listings.length > 0 && (
          <>
            <div className="mb-4">
              <p className="text-gray-600">
                Found {listings.length} listing{listings.length !== 1 ? 's' : ''} for "{query}"
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map(listing => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onThumbsUp={handleThumbsUp}
                  onThumbsDown={handleThumbsDown}
                />
              ))}
            </div>
          </>
        )}

        {!hasSearched && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Search for Headlights
            </h2>
            <p className="text-gray-600">
              Enter a vehicle make, model, and year to find headlight listings
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
