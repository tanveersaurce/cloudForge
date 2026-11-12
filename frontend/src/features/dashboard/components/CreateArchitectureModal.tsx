import { Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useUiStore } from '@/store/useUiStore';

const AWS_REGIONS = [
  'us-east-1 (N. Virginia)',
  'us-west-2 (Oregon)',
  'eu-west-1 (Ireland)',
  'ap-south-1 (Mumbai)',
];

export function CreateArchitectureModal() {
  const navigate = useNavigate();
  const open = useUiStore((state) => state.createModalOpen);
  const setOpen = useUiStore((state) => state.setCreateModalOpen);

  const [name, setName] = useState('production-core-vpc');
  const [region, setRegion] = useState(AWS_REGIONS[0]);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Create New Architecture"
      subtitle="Phase 03 Architecture Builder Preview"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p>
            Full architecture creation and the interactive{' '}
            <code className="font-mono text-sky-300">@xyflow/react</code> canvas launch in Phase 03.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="arch-name-input" className="block text-xs font-medium text-slate-300">
            Architecture Name
          </label>
          <input
            id="arch-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
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
            className="w-full rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {AWS_REGIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-canvas/60 px-3 py-2.5 text-xs">
          <span className="text-slate-400">Target Canvas Engine</span>
          <Badge variant="info">React Flow (@xyflow/react) &middot; Phase 03</Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setOpen(false);
              navigate('/builder');
            }}
          >
            View Builder Roadmap
          </Button>
        </div>
      </div>
    </Modal>
  );
}
