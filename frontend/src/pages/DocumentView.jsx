import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { addToEmergency, removeFromEmergency, checkEmergency } from '../api/emergency';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Spinner = () => (
  <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

const categoryStyles = {
  'Identity Proof': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  'Medical Record': 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  'Insurance Policy': 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30',
  'Financial Document': 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
  'Educational Certificate': 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30',
  'Legal Document': 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
  'Property Document': 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30',
  'Tax Document': 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30',
  Uncategorized: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/30',
  Other: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/30',
};

const formatBytes = (bytes) => {
  if (typeof bytes !== 'number') return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inEmergency, setInEmergency] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/api/documents/${id}`);
        if (active) setDocument(data);
      } catch (err) {
        if (active) setError(err?.response?.data?.message || 'Failed to load document.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDocument();

    return () => {
      active = false;
    };
  }, [id]);

  // Check emergency status when document loads
  useEffect(() => {
    if (!document || user?.role !== 'admin') return;
    checkEmergency(document._id)
      .then(({ data }) => setInEmergency(data.inEmergency))
      .catch(() => setInEmergency(false));
  }, [document, user?.role]);

  const handleEmergencyToggle = async () => {
    if (!document || user?.role !== 'admin') return;
    setEmergencyLoading(true);
    setActionMessage('');
    try {
      if (inEmergency) {
        await removeFromEmergency(document._id);
        setInEmergency(false);
        setActionMessage('Removed from Emergency');
      } else {
        await addToEmergency(document._id);
        setInEmergency(true);
        setActionMessage('Added to Emergency');
      }
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Operation failed');
    } finally {
      setEmergencyLoading(false);
    }
  };

  const fileUrl = useMemo(() => {
    if (!document?.filePath) return '';
    return `http://localhost:5000/uploads/${document.filePath}`;
  }, [document]);

  const extractedEntries = useMemo(() => {
    if (!document?.extractedInfo) return [];
    return Object.entries(document.extractedInfo);
  }, [document]);

  const tags = Array.isArray(document?.tags) ? document.tags : [];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white"
          >
            ← Back to dashboard
          </button>
          {user?.role === 'admin' && document && (
            <button
              type="button"
              disabled={emergencyLoading}
              onClick={handleEmergencyToggle}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                inEmergency
                  ? 'border-rose-400/30 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              }`}
            >
              <span className="text-lg">{inEmergency ? '🛡' : '⚠'}</span>
              {emergencyLoading ? 'Saving...' : inEmergency ? 'Remove from Emergency' : 'Add to Emergency'}
            </button>
          )}
        </div>
        {actionMessage && (
          <p className={`mb-4 text-sm font-medium ${actionMessage.includes('failed') ? 'text-rose-300' : 'text-emerald-300'}`}>
            {actionMessage}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 py-20 text-slate-300">
            <div className="flex items-center gap-3">
              <Spinner /> Loading document...
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200">
            <p className="font-semibold">{error}</p>
            <Link to="/dashboard" className="mt-3 inline-block text-sm font-medium text-sky-300 hover:text-sky-200">
              Return to dashboard
            </Link>
          </div>
        ) : document ? (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Document details</p>
                  <h2 className="mt-2 text-3xl font-bold text-white">{document.label || document.originalName}</h2>
                  <p className="mt-2 text-sm text-slate-400">{document.originalName}</p>
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    categoryStyles[document.category] || categoryStyles.Other
                  }`}
                >
                  {document.category || 'Other'}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="AI status" value={document.aiStatus} />
                <Info label="Uploaded by" value={document.uploadedBy?.name || 'Unknown'} />
                <Info label="File size" value={formatBytes(document.fileSize)} />
                <Info label="Created" value={new Date(document.createdAt).toLocaleString()} />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <Panel title="Preview">
                  {document.fileType?.startsWith('image/') ? (
                    <img
                      src={fileUrl}
                      alt={document.originalName}
                      className="max-h-[640px] w-full rounded-2xl border border-white/10 object-contain bg-black/20"
                    />
                  ) : (
                    <div className="space-y-4">
                      <p className="text-slate-300">This document is stored as a PDF.</p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white hover:bg-sky-400"
                      >
                        Open PDF in new tab
                      </a>
                      <iframe
                        title={document.originalName}
                        src={fileUrl}
                        className="h-[640px] w-full rounded-2xl border border-white/10 bg-white"
                      />
                    </div>
                  )}
                </Panel>

                <Panel title="AI summary">
                  <p className="whitespace-pre-line leading-7 text-slate-200">
                    {document.summary || 'AI summary not available yet.'}
                  </p>
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/10">
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-slate-400">No tags available.</p>
                    )}
                  </div>
                </Panel>

                <Panel title="Extracted information">
                  {extractedEntries.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <table className="min-w-full divide-y divide-white/10 text-sm">
                        <tbody className="divide-y divide-white/10">
                          {extractedEntries.map(([key, value]) => (
                            <tr key={key} className="bg-slate-950/40">
                              <th className="w-1/2 px-4 py-3 text-left font-medium text-slate-300">{key}</th>
                              <td className="px-4 py-3 text-slate-100">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-400">No extracted info yet.</p>
                  )}
                </Panel>

                <Panel title="Metadata">
                  <div className="space-y-3 text-sm text-slate-300">
                    <MetaRow label="Original name" value={document.originalName} />
                    <MetaRow label="File type" value={document.fileType} />
                    <MetaRow label="Label" value={document.label || '—'} />
                    <MetaRow label="Category" value={document.category || 'Other'} />
                    <MetaRow label="Family ID" value={document.familyId || '—'} />
                    <MetaRow label="File path" value={document.filePath} />
                  </div>
                </Panel>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-white">{value || '—'}</p>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex flex-col items-start justify-between gap-1 border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="w-full break-all text-left font-medium text-slate-100">{value || '—'}</span>
    </div>
  );
}
