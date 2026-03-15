import { useParams } from 'react-router-dom';

export function IncidentDetailPage() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Incident Details</h1>
      <div className="bg-white rounded-lg border border-surface-border p-6">
        <p className="text-gray-600">Incident detail view for ID: {id} will be implemented here.</p>
      </div>
    </div>
  );
}