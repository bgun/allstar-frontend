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
