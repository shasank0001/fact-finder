import express, { Request, Response, NextFunction } from 'express'
import dotenv from 'dotenv'
import axios from 'axios'
import path from 'node:path'
import fs from 'node:fs'
import * as wppconnect from '@wppconnect-team/wppconnect'

dotenv.config()

const PORT = parseInt(process.env.PORT || '8088', 10)
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000/api'
const SESSION = process.env.WHATSAPP_SESSION || 'FactState-Session'
const API_TOKEN = process.env.WHATSAPP_API_TOKEN || ''
const CHROME_PATH = process.env.CHROME_PATH || ''

const app = express()
app.use(express.json({ limit: '1mb' }))

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!API_TOKEN) return next()
  const h = req.headers['x-api-token']
  if (h !== API_TOKEN) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

let clientPromise: Promise<wppconnect.Whatsapp> | null = null
let lastStatus: string | null = null
let lastQrData: string | null = null

function getClient() {
  if (!clientPromise) {
    clientPromise = wppconnect
      .create({
        session: SESSION,
        statusFind: (statusSession: any, session: any) => {
          lastStatus = String(statusSession)
          console.log('WPP Status:', statusSession, session)
        },
        catchQR: (base64Qrimg: string, asciiQR: string, _attempt: any, _urlCode: any) => {
          // Persist latest QR to disk for quick sharing
          const outDir = path.join(process.cwd(), 'qr')
          fs.mkdirSync(outDir, { recursive: true })
          const file = path.join(outDir, 'latest.txt')
          const data = base64Qrimg.startsWith('data:image') ? base64Qrimg : `data:image/png;base64,${base64Qrimg}`
          fs.writeFileSync(file, data)
          lastQrData = data
          // Also print ASCII QR to console as a fallback
          try { console.log("\nScan this QR (ASCII fallback):\n" + asciiQR + "\n") } catch {}
        },
        headless: true,
        logQR: false,
        browserArgs: ['--no-sandbox','--disable-setuid-sandbox'],
        puppeteerOptions: CHROME_PATH ? { executablePath: CHROME_PATH } : undefined
      })
      .then((client: wppconnect.Whatsapp) => {
        console.log('WPPConnect ready')
        return client
      })
  }
  return clientPromise
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, session: SESSION })
})

// Simple landing page to render the QR and basic actions
app.get('/', (_req: Request, res: Response) => {
  res.type('html').send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FactState WhatsApp</title>
    <style>
      body{font-family:system-ui,Segoe UI,Arial;background:#0b1220;color:#e2e8f0;margin:0;padding:24px}
      .card{max-width:720px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:20px}
      .qr{display:grid;place-items:center;min-height:280px;border:1px dashed rgba(148,163,184,.3);border-radius:12px;background:#0b1329}
      img{max-width:260px;image-rendering:pixelated}
      .row{display:flex;gap:8px;margin-top:12px}
      input,button{padding:10px;border-radius:8px;border:1px solid rgba(148,163,184,.25);background:#0b1329;color:#e2e8f0}
      button{background:#2563eb;border:none;cursor:pointer}
      small{color:#94a3b8}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>FactState WhatsApp Service</h2>
      <p>Scan the QR below with WhatsApp on your phone to pair this session.</p>
      <div id="qr" class="qr">Loading QR…</div>
      <small id="status"></small>
      <script>
        async function pollQR(){
          try{
            const r = await fetch('/qr');
            if(r.status===200){
              const txt = await r.text();
              if(txt.startsWith('data:image')){
                document.getElementById('qr').innerHTML = '<img alt="QR" src="'+txt+'" />';
                document.getElementById('status').textContent = 'If the QR expires, refresh the page.';
              } else {
                document.getElementById('qr').textContent = 'QR data received but not an image.';
              }
            } else {
              const j = await r.json().catch(()=>({message:'Generating QR…'}));
              document.getElementById('qr').textContent = j.message || 'Generating QR…';
            }
          }catch(e){
            document.getElementById('qr').textContent = 'Waiting for service…';
          } finally {
            setTimeout(pollQR, 2000);
          }
        }
        pollQR();
      </script>
    </div>
  </body>
  </html>`)
})

app.get('/qr', async (_req: Request, res: Response) => {
  try {
    const file = path.join(process.cwd(), 'qr', 'latest.txt')
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8')
      return res.type('text/plain').send(data)
    }
    // Trigger client init to generate QR
    await getClient()
    return res.status(202).json({ message: 'QR not ready, try again shortly' })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

app.get('/status', async (_req: Request, res: Response) => {
  try {
    const file = path.join(process.cwd(), 'qr', 'latest.txt')
    const hasQR = fs.existsSync(file)
    const qrMtime = hasQR ? fs.statSync(file).mtimeMs : null
    let state: any = lastStatus
    let isAuthenticated = false
    try {
      const client = await getClient()
      const anyClient = client as any
      if (typeof anyClient.isAuthenticated === 'function') {
        isAuthenticated = await anyClient.isAuthenticated()
      }
      if (!state && typeof anyClient.getConnectionState === 'function') {
        state = await anyClient.getConnectionState()
      }
    } catch {}
    res.json({ hasQR, qrMtime, state, isAuthenticated, memoryQR: !!lastQrData })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/send', authMiddleware, async (req: Request, res: Response) => {
  const { phone, message } = req.body as { phone?: string, message?: string }
  if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' })
  try {
    const client = await getClient()
    const jid = phone.replace(/\D/g, '') + '@c.us'
    await client.sendText(jid, message)
    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

app.post('/scan-and-send', authMiddleware, async (req: Request, res: Response) => {
  const { url, phone } = req.body as { url?: string, phone?: string }
  if (!url || !phone) return res.status(400).json({ error: 'url and phone are required' })
  try {
    const { data } = await axios.post(`${FASTAPI_BASE_URL}/check-site`, { url }, {headers: {Authorization: `Bearer ${process.env.API_ACCESS_TOKEN || ""}`}})
    const lines: string[] = []
    lines.push(`FactState report for: ${data.url}`)
    lines.push(`Badge: ${data.badge} | Risk: ${data.risk_score.toFixed(2)}/100`)
    lines.push('Top reasons:')
    ;(data.reasons || []).slice(0, 4).forEach((r: any) => {
      lines.push(`- [${r.layer}] ${r.message}`)
    })
    const msg = lines.join('\n')

    const client = await getClient()
    const jid = phone.replace(/\D/g, '') + '@c.us'
    await client.sendText(jid, msg)

    return res.json({ ok: true, sent: true, preview: msg })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`FactState WhatsApp server listening on :${PORT}`)
})
