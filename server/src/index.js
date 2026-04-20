import 'express-async-errors'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import { prisma } from '../lib/prisma.js'
import authRouter from '../routes/auth.js'
import clientsRouter from '../routes/clients.js'
import feesRouter from '../routes/fees.js'
import dashboardRouter from '../routes/dashboard.js'
import insuranceRouter from '../routes/insurance.js'
import fitnessRouter from '../routes/fitness.js'
import pucRouter from '../routes/puc.js'
import permitsRouter from '../routes/permits.js'
import formsRouter from '../routes/forms.js'
import revenueRouter from '../routes/revenue.js'
import quotesRouter from '../routes/quotes.js'
import remindersRouter from '../routes/reminders.js'
import settingsRouter from '../routes/settings.js'
import subscriptionRouter from '../routes/subscription.js'
import adminRouter from '../routes/admin.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json())

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/fees', feesRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/insurance', insuranceRouter)
app.use('/api/fitness', fitnessRouter)
app.use('/api/puc', pucRouter)
app.use('/api/permits', permitsRouter)
app.use('/api/forms', formsRouter)
app.use('/api/revenue', revenueRouter)
app.use('/api/quotes', quotesRouter)
app.use('/api/reminders', remindersRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/subscription', subscriptionRouter)
app.use('/api/admin', adminRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

export { prisma }
