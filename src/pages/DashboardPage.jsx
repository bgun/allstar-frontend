import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EVENT_EMOJI = {
  scrape_started: '🔍',
  scrape_completed: '✅',
  listings_stored: '💾',
  grade_started: '🤖',
  grade_completed: '📊',
  grade_failed: '❌',
  run_completed: '🏁',
  run_failed: '💥',
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDuration(start, end) {
  if (!start || !end) return '-'
  const ms = new Date(end) - new Date(start)
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return `${minutes}m ${rem}s`
}

function eventSummary(event) {
  const p = event.payload || {}
  switch (event.event_type) {
    case 'scrape_started':
      return `Scraping ${p.source || 'listings'}...`
    case 'scrape_completed':
      return `${p.source}: ${p.count ?? '?'} listings found`
    case 'listings_stored':
      return `${p.count ?? '?'} listings stored`
    case 'grade_started':
      return `Grading: ${p.title ? p.title.slice(0, 50) : 'listing'}...`
    case 'grade_completed':
      return `Graded ${p.grade || ''} (${p.score ?? '?'}) - ${p.title ? p.title.slice(0, 40) : ''}`
    case 'grade_failed':
      return `Failed: ${p.error || p.title || 'unknown'}`
    case 'run_completed':
      return `Run complete: ${p.graded ?? '?'} graded, avg ${p.average_score ? Math.round(p.average_score) : '?'}`
    case 'run_failed':
      return `Run failed: ${p.error || 'unknown error'}`
    default:
      return event.event_type
  }
}

function StatusBadge({ status }) {
  const colors = {
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status === 'running' && '● '}{status}
    </span>
  )
}

export default function DashboardPage() {
  const [events, setEvents] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [agentStatus, setAgentStatus] = useState(null) // null=loading, 'online'|'offline'
  const [agentRunning, setAgentRunning] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const eventsEndRef = useRef(null)

  async function checkAgentHealth() {
    try {
      const res = await fetch('/api/agent/health')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAgentStatus('online')
      setAgentRunning(data.isRunning)
    } catch {
      setAgentStatus('offline')
      setAgentRunning(false)
    }
  }

  async function triggerAgent(dryRun) {
    if (dryRun === false && !window.confirm('Start a full agent run? This will call the Anthropic API and use tokens.')) {
      return
    }
    setTriggering(true)
    try {
      const res = await fetch(`/api/agent/trigger?dry_run=${dryRun}`, { method: 'POST' })
      if (res.status === 409) {
        alert('A run is already in progress.')
      } else if (!res.ok) {
        const data = await res.json()
        alert(`Failed to trigger agent: ${data.error || res.statusText}`)
      } else {
        setAgentRunning(true)
      }
    } catch (err) {
      alert(`Failed to reach agent: ${err.message}`)
    } finally {
      setTriggering(false)
    }
  }

  useEffect(() => {
    loadData()
    checkAgentHealth()

    // Poll agent health every 30s
    const healthInterval = setInterval(checkAgentHealth, 30000)

    // Subscribe to realtime agent_events
    const channel = supabase
      .channel('agent-events-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_events',
      }, (payload) => {
        setEvents((prev) => [payload.new, ...prev])
      })
      .subscribe()

    return () => {
      clearInterval(healthInterval)
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadData() {
    setLoading(true)

    const [eventsRes, runsRes] = await Promise.all([
      supabase
        .from('agent_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('agent_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20),
    ])

    setEvents(eventsRes.data || [])
    setRuns(runsRes.data || [])
    setLoading(false)
  }

  const activeRun = runs.find((r) => r.status === 'running')

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>

        <span className={`text-xs px-2 py-0.5 rounded-full ${
          agentStatus === 'online' ? 'bg-green-100 text-green-700' :
          agentStatus === 'offline' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {agentStatus === 'online' ? 'Agent Online' : agentStatus === 'offline' ? 'Agent Offline' : 'Checking...'}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => triggerAgent(true)}
            disabled={agentStatus !== 'online' || agentRunning || triggering}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Dry Run
          </button>
          <button
            onClick={() => triggerAgent(false)}
            disabled={agentStatus !== 'online' || agentRunning || triggering}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Agent
          </button>
        </div>
      </div>

      {activeRun && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="animate-pulse w-3 h-3 bg-blue-500 rounded-full" />
          <div>
            <p className="text-sm font-medium text-blue-900">Agent is currently running</p>
            <p className="text-xs text-blue-700">
              Started {timeAgo(activeRun.started_at)} &middot; {activeRun.listings_scraped} scraped &middot; {activeRun.listings_graded} graded
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Event Feed */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Live Events</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No events yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {events.map((event) => (
                    <div key={event.id} className="px-3 py-2 flex items-start gap-2">
                      <span className="text-sm mt-0.5">{EVENT_EMOJI[event.event_type] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{eventSummary(event)}</p>
                        <p className="text-[10px] text-gray-400">{timeAgo(event.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={eventsEndRef} />
            </div>
          </div>
        </div>

        {/* Run History */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Run History</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {runs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No runs yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {runs.map((run) => (
                  <div key={run.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={run.status} />
                      <span className="text-xs text-gray-400">{timeAgo(run.started_at)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>Scraped: {run.listings_scraped}</span>
                      <span>Graded: {run.listings_graded}</span>
                      <span>Failed: {run.listings_failed}</span>
                      {run.average_score && <span>Avg: {Math.round(run.average_score)}</span>}
                    </div>
                    <div className="flex gap-4 text-[10px] text-gray-400 mt-0.5">
                      <span>Duration: {formatDuration(run.started_at, run.finished_at)}</span>
                      {run.prompt_version && <span>Prompt: {run.prompt_version}</span>}
                    </div>
                    {run.error_message && (
                      <p className="text-xs text-red-600 mt-1 truncate">{run.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
