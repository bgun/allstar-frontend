import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const GRADE_COLORS = {
  A: 'bg-green-500',
  B: 'bg-green-400',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
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

function FeedbackForm({ grade, listingTitle, onClose, onSubmit }) {
  const [verdict, setVerdict] = useState('')
  const [wouldBuy, setWouldBuy] = useState(false)
  const [adjustedScore, setAdjustedScore] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!verdict) return
    setSubmitting(true)
    await onSubmit({
      grade_id: grade.id,
      verdict,
      would_buy: wouldBuy,
      adjusted_score: adjustedScore ? parseInt(adjustedScore) : null,
      notes: notes || null,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-900">Grade Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">&times;</button>
        </div>

        <h4 className="text-sm font-medium text-gray-700 mb-2">{listingTitle}</h4>

        <div className="flex items-center gap-3 mb-3">
          <GradeBadge grade={grade.grade_letter} score={grade.score} />
          <span className="text-xs text-gray-500">Graded {timeAgo(grade.graded_at)}</span>
        </div>

        <p className="text-sm text-gray-600 mb-3">{grade.rationale}</p>

        {grade.flags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {grade.flags.map((flag, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{flag}</span>
            ))}
          </div>
        )}

        <hr className="my-4" />

        <h4 className="text-sm font-bold text-gray-900 mb-3">Your Feedback</h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Do you agree with this grade?</label>
            <div className="flex gap-2">
              {[
                { value: 'agree', label: 'Agree' },
                { value: 'disagree', label: 'Disagree' },
                { value: 'partially_agree', label: 'Partially' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVerdict(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-md border cursor-pointer ${
                    verdict === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={wouldBuy}
              onChange={(e) => setWouldBuy(e.target.checked)}
              className="w-4 h-4"
            />
            Would buy this listing
          </label>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Your score (optional, 1-100)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={adjustedScore}
              onChange={(e) => setAdjustedScore(e.target.value)}
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md"
              placeholder="50"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              placeholder="Why do you agree/disagree?"
            />
          </div>

          <button
            type="submit"
            disabled={!verdict || submitting}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ListingsPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [selectedListing, setSelectedListing] = useState(null)
  const [feedbackSent, setFeedbackSent] = useState(new Set())
  const [runInfo, setRunInfo] = useState(null)
  const [gradeUrl, setGradeUrl] = useState('')
  const [grading, setGrading] = useState(false)
  const [gradeResult, setGradeResult] = useState(null)
  const [gradeError, setGradeError] = useState(null)
  const [sortBy, setSortBy] = useState('score_desc')
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    loadGradedListings()
  }, [])

  async function loadGradedListings() {
    setLoading(true)

    // Get the most recent completed agent run
    const { data: runs } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1)

    const latestRun = runs?.[0]
    setRunInfo(latestRun)

    if (!latestRun?.prompt_version) {
      setListings([])
      setLoading(false)
      return
    }

    // Get grades for this prompt version, joined with listings
    const { data: grades } = await supabase
      .from('grades')
      .select(`
        *,
        listing:listings(*)
      `)
      .eq('prompt_version', latestRun.prompt_version)
      .order('score', { ascending: false })

    setListings(grades || [])
    setLoading(false)
  }

  async function handleGradeUrl(e) {
    e.preventDefault()
    if (!gradeUrl.trim() || grading) return
    setGrading(true)
    setGradeResult(null)
    setGradeError(null)
    try {
      const resp = await fetch('/api/agent/grade-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gradeUrl.trim(), triggered_by: user?.user_metadata?.full_name || user?.email || null }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setGradeError(data.error || 'Failed to grade URL')
      } else {
        setGradeResult(data)
      }
    } catch (err) {
      setGradeError(err.message || 'Network error')
    } finally {
      setGrading(false)
    }
  }

  async function handleFeedbackSubmit(feedback) {
    const { error } = await supabase
      .from('buyer_feedback')
      .insert({ ...feedback, user_id: user.id })

    if (error) {
      alert(`Error submitting feedback: ${error.message}`)
      return
    }

    setFeedbackSent((prev) => new Set([...prev, feedback.grade_id]))
    setSelectedGrade(null)
    setSelectedListing(null)
  }

  function changeSort(newSort) {
    if (newSort === sortBy) return
    setAnimating(true)
    setTimeout(() => {
      setSortBy(newSort)
      setTimeout(() => setAnimating(false), 50)
    }, 150)
  }

  const sortedListings = useMemo(() => {
    const sorted = [...listings]
    switch (sortBy) {
      case 'score_desc':
        return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      case 'score_asc':
        return sorted.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      case 'date_desc':
        return sorted.sort((a, b) => {
          const da = a.listing?.listing_date || ''
          const db = b.listing?.listing_date || ''
          return db.localeCompare(da)
        })
      case 'date_asc':
        return sorted.sort((a, b) => {
          const da = a.listing?.listing_date || ''
          const db = b.listing?.listing_date || ''
          return da.localeCompare(db)
        })
      case 'price_desc':
        return sorted.sort((a, b) => (b.listing?.price_cents ?? 0) - (a.listing?.price_cents ?? 0))
      case 'price_asc':
        return sorted.sort((a, b) => (a.listing?.price_cents ?? 0) - (b.listing?.price_cents ?? 0))
      default:
        return sorted
    }
  }, [listings, sortBy])

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading graded listings...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Graded Listings</h2>
        {runInfo && (
          <div className="text-xs text-gray-500">
            Last run: {timeAgo(runInfo.finished_at)} &middot; {runInfo.listings_graded} graded &middot; avg {Math.round(runInfo.average_score || 0)}
          </div>
        )}
      </div>

      <form onSubmit={handleGradeUrl} className="mb-6 flex gap-2">
        <input
          type="url"
          value={gradeUrl}
          onChange={(e) => setGradeUrl(e.target.value)}
          placeholder="Paste an eBay or Craigslist URL to grade..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={grading}
        />
        <button
          type="submit"
          disabled={grading || !gradeUrl.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          {grading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {grading ? 'Grading...' : 'Grade'}
        </button>
      </form>

      {gradeError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {gradeError}
        </div>
      )}

      {gradeResult && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-start gap-4">
            {gradeResult.image && (
              <img
                src={gradeResult.image}
                alt={gradeResult.title}
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <GradeBadge grade={gradeResult.grade} score={gradeResult.score} />
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  gradeResult.source === 'ebay' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {gradeResult.source === 'ebay' ? 'eBay' : 'CL'}
                </span>
                {gradeResult.price && <span className="text-sm font-bold text-green-700">{gradeResult.price}</span>}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{gradeResult.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{gradeResult.rationale}</p>
              {gradeResult.flags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {gradeResult.flags.map((flag, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{flag}</span>
                  ))}
                </div>
              )}
              {gradeResult.link && (
                <a
                  href={gradeResult.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View listing
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {listings.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-gray-500 mr-1">Sort:</span>
          {[
            { key: 'score_desc', label: 'Grade High' },
            { key: 'score_asc', label: 'Grade Low' },
            { key: 'date_desc', label: 'Newest' },
            { key: 'date_asc', label: 'Oldest' },
            { key: 'price_desc', label: 'Price High' },
            { key: 'price_asc', label: 'Price Low' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => changeSort(opt.key)}
              className={`px-2.5 py-1 text-xs rounded-full border cursor-pointer transition-colors ${
                sortBy === opt.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {listings.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No graded listings yet. The agent hasn't run or no listings have been graded.</p>
      ) : (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 transition-opacity duration-150 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          {sortedListings.map((gradeRow) => {
            const listing = gradeRow.listing
            if (!listing) return null
            const hasFeedback = feedbackSent.has(gradeRow.id)

            return (
              <div
                key={gradeRow.id}
                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedGrade(gradeRow)
                  setSelectedListing(listing)
                }}
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
                  {hasFeedback && (
                    <span className="text-[10px] text-green-600 font-medium">Reviewed</span>
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
                      onClick={(e) => e.stopPropagation()}
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

      {selectedGrade && selectedListing && (
        <FeedbackForm
          grade={selectedGrade}
          listingTitle={selectedListing.title}
          onClose={() => {
            setSelectedGrade(null)
            setSelectedListing(null)
          }}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  )
}
