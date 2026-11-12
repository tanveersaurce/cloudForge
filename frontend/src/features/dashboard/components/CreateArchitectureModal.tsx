import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { createArchitecture } from '@/features/architecture-builder/services/architectureService';
import { ApiClientError } from '@/services/apiClient';
import { useUiStore } from '@/store/useUiStore';

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
];

export function CreateArchitectureModal() {
  const navigate = useNavigate();
  const open = useUiStore((state) => state.createModalOpen);
  const setOpen = useUiStore((state) => state.setCreateModalOpen);

  const [name, setName] = useState('production-core-vpc');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState(AWS_REGIONS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Architecture name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createArchitecture({
        name: trimmedName,
        description: description.trim() || undefined,
        region,
      });
      setOpen(false);
      setDescription('');
      navigate(`/architecture-builder/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unable to create architecture.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) {
          setError(null);
          setOpen(false);
        }
      }}
      title="Create New Architecture"
      subtitle="Initialize a persistent AWS topology workspace"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="arch-name-input" className="block text-xs font-medium text-slate-300">
            Architecture Name
          </label>
          <input
            id="arch-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            required
            maxLength={120}
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="arch-desc-input" className="block text-xs font-medium text-slate-300">
            Description <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            id="arch-desc-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            maxLength={500}
            placeholder="High-availability multi-AZ web workload..."
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="arch-region-select" className="block text-xs font-medium text-slate-300">
            Primary AWS Region
          </label>
          <select
            id="arch-region-select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-50"
          >
            {AWS_REGIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create &amp; Open Canvas</span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
