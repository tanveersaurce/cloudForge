import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Terminal,
  ShieldAlert,
  Info,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Layers,
  Box,
  Archive,
} from 'lucide-react';
import { generateTerraformApi } from './terraformService';
import type {
  TerraformExportMode,
  TerraformFile,
  TerraformIssue,
} from './terraformService';
import { createZipArchive } from './zipUtility';

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  children?: TreeNode[];
  file?: TerraformFile;
}

function buildDirectoryTree(files: TerraformFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let currentLevel = root;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        currentLevel.push({
          name: part,
          fullPath: accumulatedPath,
          isFolder: false,
          file,
        });
      } else {
        let folderNode = currentLevel.find(
          (node) => node.isFolder && node.name === part,
        );
        if (!folderNode) {
          folderNode = {
            name: part,
            fullPath: accumulatedPath,
            isFolder: true,
            children: [],
          };
          currentLevel.push(folderNode);
        }
        currentLevel = folderNode.children!;
      }
    }
  }

  // Sort folders first, then files alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };

  sortNodes(root);
  return root;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.tf')) {
    return <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
  }
  if (filename.endsWith('.md')) {
    return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  if (filename.endsWith('.example') || filename.startsWith('.')) {
    return <File className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  return <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
}

export const TerraformExportPage: React.FC = () => {
  const { architectureId } = useParams<{ architectureId: string }>();

  const [exportMode, setExportMode] = useState<TerraformExportMode>('modular');
  const [files, setFiles] = useState<TerraformFile[] | null>(null);
  const [hcl, setHcl] = useState<string | null>(null);
  const [issues, setIssues] = useState<TerraformIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Active view: specific file or all files combined
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [viewCombined, setViewCombined] = useState(false);

  // Expanded folders in tree (auto-expand all directories on generation)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (files) {
      const folders = new Set<string>();
      files.forEach((f) => {
        const parts = f.filename.split('/');
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          folders.add(acc);
        }
      });
      setExpandedFolders(folders);
    }
  }, [files]);

  const loadTerraform = useCallback(async () => {
    if (!architectureId) {
      setError('Architecture ID is missing');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateTerraformApi(architectureId, exportMode);
      setFiles(data.files);
      setHcl(data.hcl);
      setIssues(data.issues ?? []);

      // Default selected file: main.tf or first file
      if (data.files && data.files.length > 0) {
        const defaultFile =
          data.files.find((f) => f.filename === 'main.tf') ||
          data.files.find((f) => f.filename === 'versions.tf') ||
          data.files[0];
        setSelectedFilePath(defaultFile.filename);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Terraform');
    } finally {
      setIsLoading(false);
    }
  }, [architectureId, exportMode]);

  useEffect(() => {
    void loadTerraform();
  }, [loadTerraform]);

  const tree = useMemo(() => {
    return files ? buildDirectoryTree(files) : [];
  }, [files]);

  const activeFile = useMemo(() => {
    if (!files || !selectedFilePath) return null;
    return files.find((f) => f.filename === selectedFilePath) || files[0] || null;
  }, [files, selectedFilePath]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const copyToClipboard = async () => {
    const textToCopy = viewCombined ? (hcl || '') : (activeFile?.content || '');
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadZipProject = () => {
    if (!files || files.length === 0) return;
    const blob = createZipArchive(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `terraform-${exportMode}-${architectureId || 'project'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllFlat = () => {
    if (!files || files.length === 0) return;
    files.forEach((file) => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename.replace(/\//g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  if (!architectureId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md w-full p-6 rounded-xl border border-slate-800 bg-slate-900 text-center">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-100">No architecture selected</h2>
          <p className="text-xs text-slate-400 mt-2 mb-4">
            Please select an architecture to generate Terraform HCL.
          </p>
          <Link
            to="/terraform"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-500 transition"
          >
            Select Architecture
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading && !files) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span>Generating {exportMode === 'modular' ? 'Modular' : 'Standard'} Terraform Project...</span>
          <span className="text-xs text-slate-500">Resolving dependencies and validating resource schemas</span>
        </div>
      </div>
    );
  }

  if (error && !files) {
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

  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      if (node.isFolder) {
        const isExpanded = expandedFolders.has(node.fullPath);
        return (
          <div key={node.fullPath} className="select-none">
            <div
              onClick={() => toggleFolder(node.fullPath)}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className="flex items-center gap-1.5 py-1 px-2 rounded text-xs text-slate-300 hover:bg-slate-800/60 cursor-pointer font-mono"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const isSelected = !viewCombined && selectedFilePath === node.fullPath;
      return (
        <div
          key={node.fullPath}
          onClick={() => {
            setSelectedFilePath(node.fullPath);
            setViewCombined(false);
          }}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          className={`flex items-center gap-1.5 py-1 px-2 rounded text-xs font-mono cursor-pointer transition select-none ${
            isSelected
              ? 'bg-indigo-600/30 text-indigo-200 border-l-2 border-indigo-400 font-semibold'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          {getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to={`/architecture-builder/${architectureId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Canvas</span>
          </Link>

          {/* Mode Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-2">
            <button
              type="button"
              onClick={() => setExportMode('modular')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                exportMode === 'modular'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Reusable child modules, inputs/outputs, and root module orchestration"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Modular Terraform</span>
              <span className="px-1 text-[9px] uppercase font-bold tracking-wider rounded bg-indigo-500/30 text-indigo-200">
                New
              </span>
            </button>
            <button
              type="button"
              onClick={() => setExportMode('standard')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                exportMode === 'standard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Flat folder structure categorized by AWS service"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Standard</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {(errorCount > 0 || warningCount > 0) && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                errorCount > 0
                  ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                  : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {errorCount} error{s(errorCount)}
                {warningCount > 0 && ` / ${warningCount} warning${s(warningCount)}`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!hcl && !activeFile}
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
                <span>{viewCombined ? 'Copy All HCL' : 'Copy File'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={downloadZipProject}
            disabled={!files || files.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition disabled:opacity-50"
            title="Download full project with intact directory structure as a ZIP archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Download Project (.zip)</span>
          </button>

          {exportMode === 'standard' && (
            <button
              type="button"
              onClick={downloadAllFlat}
              disabled={!files || files.length === 0}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Loose .tf</span>
            </button>
          )}
        </div>
      </header>

      {/* Mode Explanation Banner */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          {exportMode === 'modular' ? (
            <span>
              <strong className="text-slate-200">Modular Terraform:</strong> Reusable child modules grouped by architecture domains with root module orchestration, explicit inputs, outputs, and multi-environment configuration.
            </span>
          ) : (
            <span>
              <strong className="text-slate-200">Standard Terraform:</strong> Flat resource files organized into AWS service folders for straightforward single-file or direct deployment.
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          {files?.length ?? 0} files generated
        </div>
      </div>

      {/* Critical Issue Alert Banner if Errors exist */}
      {errorCount > 0 && (
        <div className="bg-rose-950/40 border-b border-rose-500/30 px-6 py-2 flex items-center gap-2 text-xs text-rose-300">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>Attention:</strong> {errorCount} dependency or configuration error{s(errorCount)} detected. Check the review panel before running <code>terraform apply</code>.
          </span>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 overflow-hidden flex">
        {/* Issues Panel */}
        {(errorCount > 0 || warningCount > 0) && (
          <div className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Review Diagnostics
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {issues.length} item{s(issues.length)}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {issues.map((issue, idx) => (
                <div
                  key={`${issue.nodeId}-${issue.missing}-${idx}`}
                  className={`p-2.5 rounded-lg border text-xs ${
                    issue.severity === 'error'
                      ? 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                      : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-200">{issue.resourceType}</span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                        issue.severity === 'error'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">{issue.missing}</div>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">Node ID: {issue.nodeId}</div>
                </div>
              ))}
              <div className="p-2 text-[10px] text-slate-500 border-t border-slate-800/80">
                Resolve required inputs in the Canvas Inspector, then regenerate code.
              </div>
            </div>
          </div>
        )}

        {/* Directory Tree Panel */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Project Explorer
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setViewCombined((prev) => !prev)}
              className={`px-2 py-0.5 text-[10px] rounded border transition ${
                viewCombined
                  ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                  : 'text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Show all files combined into one document"
            >
              {viewCombined ? 'All Files' : 'Combined'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {renderTreeNodes(tree)}
          </div>
        </div>

        {/* Code Editor / Preview Panel */}
        <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
          {/* File Header Bar */}
          <div className="h-10 border-b border-slate-800 bg-slate-900/50 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              {viewCombined ? (
                <>
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>All Terraform Files Combined (Overview)</span>
                </>
              ) : activeFile ? (
                <>
                  {getFileIcon(activeFile.filename)}
                  <span className="text-slate-200">{activeFile.filename}</span>
                </>
              ) : (
                <span>No file selected</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
              {!viewCombined && activeFile && (
                <span>
                  {activeFile.content.split('\n').length} lines
                </span>
              )}
              {viewCombined && files && (
                <span>{files.length} files included</span>
              )}
            </div>
          </div>

          {/* File Content Display */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 leading-relaxed bg-slate-950">
            {viewCombined ? (
              hcl ? (
                <pre className="whitespace-pre-wrap">{hcl}</pre>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  <Info className="w-4 h-4 mr-2" />
                  No Terraform configuration available.
                </div>
              )
            ) : activeFile ? (
              <pre className="whitespace-pre-wrap">{activeFile.content}</pre>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                <Info className="w-4 h-4 mr-2" />
                Select a file from the Project Explorer to preview its contents.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

function s(count: number): string {
  return count === 1 ? '' : 's';
}
