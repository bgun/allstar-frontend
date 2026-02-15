export function ListingCard({ listing, onThumbsUp, onThumbsDown }) {
  const formatPrice = (priceCents) => {
    if (!priceCents) return 'Price not listed'
    return `$${(priceCents / 100).toFixed(2)}`
  }

  const getSourceBadgeColor = (source) => {
    return source === 'ebay' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="relative h-48 bg-gray-200">
        {listing.image_urls && listing.image_urls.length > 0 ? (
          <img
            src={listing.image_urls[0]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image
          </div>
        )}
        {/* Source Badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getSourceBadgeColor(listing.source)}`}>
            {listing.source}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600"
          >
            {listing.title}
          </a>
        </h3>

        {/* Price */}
        <p className="text-2xl font-bold text-gray-900 mb-2">
          {formatPrice(listing.price_cents)}
        </p>

        {/* Location */}
        {listing.location && (
          <p className="text-sm text-gray-600 mb-2">
            📍 {listing.location}
          </p>
        )}

        {/* Seller Info (for eBay) */}
        {listing.seller_name && (
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <span className="mr-2">Seller: {listing.seller_name}</span>
            {listing.seller_rating && (
              <span className="text-yellow-600">★ {listing.seller_rating}</span>
            )}
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-700 mb-4 line-clamp-2">
            {listing.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onThumbsUp(listing)}
            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
          >
            💾 Save
          </button>
          <button
            onClick={() => onThumbsDown(listing)}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            👎 Hide
          </button>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-center"
        >
          View on {listing.source === 'ebay' ? 'eBay' : 'Craigslist'} →
        </a>
      </div>
    </div>
  )
}
