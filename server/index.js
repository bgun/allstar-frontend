import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabase } from './lib/supabase.js'
import ebayDeletionRouter from './routes/ebay-deletion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// User preferences endpoint
app.get('/api/preferences/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('search_preferences')
      .eq('id', req.params.userId)
      .single()
    if (error) return res.status(404).json({ error: 'Profile not found' })
    res.json(data.search_preferences || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/preferences/:userId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ search_preferences: req.body })
      .eq('id', req.params.userId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Agent proxy endpoints
const AGENT_URL = process.env.AGENT_URL // e.g. https://allstar-grading-agent-production.up.railway.app
const AGENT_API_TOKEN = process.env.AGENT_API_TOKEN || ''

app.get('/api/agent/health', async (_req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  try {
    const resp = await fetch(`${AGENT_URL}/health`)
    const data = await resp.json()
    res.json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

app.post('/api/agent/trigger', async (req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  const dryRun = req.query.dry_run === 'true'
  try {
    const resp = await fetch(`${AGENT_URL}/trigger?dry_run=${dryRun}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggered_by: req.body?.triggered_by }),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

app.post('/api/agent/grade-url', async (req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  try {
    const resp = await fetch(`${AGENT_URL}/grade-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: req.body.url, triggered_by: req.body?.triggered_by }),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

app.post('/api/agent/stop', async (_req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  try {
    const resp = await fetch(`${AGENT_URL}/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AGENT_API_TOKEN}` },
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

app.get('/api/agent/stats', async (_req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  try {
    const resp = await fetch(`${AGENT_URL}/stats`, {
      headers: { 'Authorization': `Bearer ${AGENT_API_TOKEN}` },
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

app.get('/api/agent/system-prompt', async (_req, res) => {
  if (!AGENT_URL) return res.status(503).json({ error: 'AGENT_URL not configured' })
  try {
    const resp = await fetch(`${AGENT_URL}/system-prompt`, {
      headers: { 'Authorization': `Bearer ${AGENT_API_TOKEN}` },
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err) {
    res.status(503).json({ error: 'Agent unreachable', detail: err.message })
  }
})

// eBay Marketplace Account Deletion notifications
app.use('/api/ebay-deletion', ebayDeletionRouter)

// Serve React frontend in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
