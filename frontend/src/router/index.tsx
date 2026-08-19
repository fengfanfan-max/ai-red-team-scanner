import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'

import { MainLayout } from '../layouts'

const HomePage = lazy(() => import('../pages/Home').then((m) => ({ default: m.HomePage })))
const NotFoundPage = lazy(() => import('../pages/NotFound').then((m) => ({ default: m.NotFoundPage })))

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
  {
    element: <MainLayout />,
    children: [
      {
        element: <LazyRouteBoundary />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/login', element: <div className="p-8">Login (M1)</div> },
          { path: '/register', element: <div className="p-8">Register (M1)</div> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
