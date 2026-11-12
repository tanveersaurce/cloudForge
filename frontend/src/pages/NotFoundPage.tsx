import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-sky-400">404</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-100">Route Not Found</h1>
        <p className="mt-2 text-sm text-slate-400">
          The requested CloudForge workspace path does not exist.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/">
            <Button variant="primary">
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
