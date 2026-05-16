import express from 'express'
import OpenAI from 'openai'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get('/', (_req, res) => {
  res.json({
    name: 'img2pdf backend',
    ok: true,
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/ai/placeholder', async (_req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(501).json({
      error: 'OPENAI_API_KEY is not configured yet.',
    })
    return
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  res.json({
    ok: true,
    modelClientReady: Boolean(openai),
  })
})

export default app
