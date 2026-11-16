import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Terminal,
} from 'lucide-react';
import { generateTerraformApi } from './terraformService';
import type { TerraformFile } from './terraformService';

export const TerraformExportPage: React.FC = () => {
  const { architectureId } = useParams<{ architectureId: string }>();

  const [files, setFiles] = useState<TerraformFile[] | null>(null);
  const [hcl, setHcl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTerraform = useCallback(async () => {
    if (!architectureId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateTerraformApi(architectureId);
      setFiles(data.files);
      setHcl(data.hcl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Terraform');
    } finally {
      setIsLoading(false);
    }
  }, [architectureId]);

  useEffect(() => {
    void loadTerraform();
  }, [loadTerraform]);

  const copyToClipboard = async () => {
    if (!hcl) return;
    await navigator.clipboard.writeText(hcl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAll = () => {
    if (!files || files.length === 0) return;
    files.forEach((file) => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  if (isLoading && !hcl) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Generating Terraform HCL...</span>
        </div>
      </div>
    );
  }

  if (error && !hcl) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md w-full p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-rose-300">Terraform Generation Error</h2>
          <p className="text-xs text-slate-400 mt-2 mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to={`/architecture-builder/${architectureId}`}
              className="px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              Back to Canvas
            </Link>
            <button
              type="button"
              onClick={loadTerraform}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to={`/architecture-builder/${architectureId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Canvas</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!hcl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy HCL</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={!files || files.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download All (.tf)</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        {/* File Tree */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Terraform Files</h3>
            <p className="text-xs text-slate-500 mt-1">{files?.length ?? 0} files</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {files?.map((file) => (
              <div
                key={file.filename}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-slate-800/50 cursor-pointer group"
              >
                <Terminal className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                <span className="truncate text-slate-300 group-hover:text-slate-100 font-mono">
                  {file.filename}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* HCL Editor Preview */}
        <div className="flex-1 bg-slate-950 relative flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">HCL Preview</h3>
              <p className="text-xs text-slate-500 mt-1">
                Copy or download the generated Terraform configuration
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              {files?.length ?? 0} resources
            </span>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed">
            {hcl ? (
              <pre className="whitespace-pre-wrap">{hcl}</pre>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                No Terraform output available
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
