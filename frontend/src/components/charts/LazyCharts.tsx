import { lazy, Suspense } from 'react';

// Chart loading fallback
const ChartLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

// Lazy load chart components
const LazyChart = lazy(() => import('./ChartComponents'));

// Main wrapper for all charts
export const ChartWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<ChartLoader />}>
    <LazyChart>
      {children}
    </LazyChart>
  </Suspense>
);

 