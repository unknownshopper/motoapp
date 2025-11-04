import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('../components/TrackingMapInner'), { ssr: false });

export default function TrackingPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Tracking</h1>
      <TrackingMap />
    </div>
  );
}
