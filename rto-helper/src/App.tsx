import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { PrivateRoute } from '@/components/PrivateRoute'
import { PageErrorBoundary } from '@/components/PageErrorBoundary'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AgentLayout } from '@/layouts/AgentLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { getAgentJwt, isJwtValid } from '@/lib/auth'
import { AdminAgentDetailPage } from '@/pages/AdminAgentDetailPage'
import { AdminAgentsPage } from '@/pages/AdminAgentsPage'
import { AdminAnalyticsPage } from '@/pages/AdminAnalyticsPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminFeesPage } from '@/pages/AdminFeesPage'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { AdminSubscriptionsPage } from '@/pages/AdminSubscriptionsPage'
import { CalculatorPage } from '@/pages/Calculator.jsx'
import { ClientDetailPage } from '@/pages/ClientDetail.jsx'
import { ClientsPage } from '@/pages/Clients.jsx'
import { DashboardPage } from '@/pages/Dashboard.jsx'
import { FormsPage } from '@/pages/Forms.jsx'
import { InsurancePage } from '@/pages/Insurance.jsx'
import { LoginPage } from '@/pages/Login.jsx'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { QuotesPage } from '@/pages/Quotes.jsx'
import { RemindersPage } from '@/pages/Reminders.jsx'
import { RevenuePage } from '@/pages/Revenue.jsx'
import { SettingsPage } from '@/pages/Settings.jsx'
import { SubscriptionPage } from '@/pages/Subscription.jsx'

function RootRedirect() {
  if (isJwtValid(getAgentJwt())) {
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/login" replace />
}

function page(node: ReactNode) {
  return <PageErrorBoundary>{node}</PageErrorBoundary>
}

export function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route element={<AuthLayout />}>
            <Route path="/login" element={page(<LoginPage />)} />
            <Route path="/admin/login" element={page(<AdminLoginPage />)} />
          </Route>
          <Route element={<PrivateRoute role="agent" />}>
            <Route element={<AgentLayout />}>
              <Route path="/dashboard" element={page(<DashboardPage />)} />
              <Route path="/calculator" element={page(<CalculatorPage />)} />
              <Route path="/clients" element={page(<ClientsPage />)} />
              <Route path="/clients/:id" element={page(<ClientDetailPage />)} />
              <Route path="/insurance" element={page(<InsurancePage />)} />
              <Route path="/forms" element={page(<FormsPage />)} />
              <Route path="/quotes" element={page(<QuotesPage />)} />
              <Route path="/revenue" element={page(<RevenuePage />)} />
              <Route path="/reminders" element={page(<RemindersPage />)} />
              <Route path="/settings" element={page(<SettingsPage />)} />
              <Route path="/subscription" element={page(<SubscriptionPage />)} />
            </Route>
          </Route>
          <Route element={<PrivateRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={page(<AdminDashboardPage />)} />
              <Route path="/admin/agents" element={page(<AdminAgentsPage />)} />
              <Route path="/admin/agents/:id" element={page(<AdminAgentDetailPage />)} />
              <Route path="/admin/fees" element={page(<AdminFeesPage />)} />
              <Route path="/admin/subscriptions" element={page(<AdminSubscriptionsPage />)} />
              <Route path="/admin/analytics" element={page(<AdminAnalyticsPage />)} />
            </Route>
          </Route>
          <Route path="*" element={page(<NotFoundPage />)} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          success: { style: { background: '#052e16', color: '#86efac', border: '1px solid #166534' } },
          error: { style: { background: '#450a0a', color: '#fca5a5', border: '1px solid #7f1d1d' } },
        }}
      />
    </>
  )
}
