import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { AuthLayout, MainLayout } from '@/layouts'
import { AuthGuard } from './AuthGuard'
import { GuestGuard } from './GuestGuard'

const HomePage = lazy(() => import('@/pages/Home').then((m) => ({ default: m.HomePage })))
const LoginPage = lazy(() => import('@/pages/Login').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() =>
  import('@/pages/Register').then((m) => ({ default: m.RegisterPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.SettingsPage }))
)
const ApplicationsPage = lazy(() =>
  import('@/pages/Applications').then((m) => ({ default: m.ApplicationsPage }))
)
const DatasetsPage = lazy(() =>
  import('@/pages/Datasets').then((m) => ({ default: m.DatasetsPage }))
)
const ScansPage = lazy(() => import('@/pages/Scans').then((m) => ({ default: m.ScansPage })))
const CreateScanPage = lazy(() =>
  import('@/pages/CreateScan').then((m) => ({ default: m.CreateScanPage }))
)
const ScanResultPage = lazy(() =>
  import('@/pages/ScanResult').then((m) => ({ default: m.ScanResultPage }))
)
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })))

function LazyRouteBoundary() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-400">Loading…</div>}>
      <Outlet />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/home" replace />,
  },
  // Auth pages (centered card, no sidebar)
  {
    element: <GuestGuard />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  // Main app (sidebar + header, requires session)
  {
    element: <AuthGuard />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            element: <LazyRouteBoundary />,
            children: [
              { path: '/home', element: <HomePage /> },
              { path: '/applications', element: <ApplicationsPage /> },
              { path: '/datasets', element: <DatasetsPage /> },
              { path: '/scans', element: <ScansPage /> },
              { path: '/scans/new', element: <CreateScanPage /> },
              { path: '/scans/:scanId', element: <ScanResultPage /> },
              { path: '/settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
