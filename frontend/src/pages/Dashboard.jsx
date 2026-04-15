import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import DocumentCard from '../components/DocumentCard';
import UploadModal from '../components/UploadModal';
import AddMemberModal from '../components/AddMemberModal';
import { useAuth } from '../context/AuthContext';

const Spinner = () => (
  <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
);

function FamilyMembersSection() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    api.get('/api/family/members')
      .then(({ data }) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  if (members.length === 0) return null;

  const roleStyles = {
    admin: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
    member: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Family</p>
          <h3 className="mt-2 text-2xl font-bold text-white">Members</h3>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-300 ring-1 ring-white/10">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <div
            key={member._id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{member.name}</p>
              <p className="truncate text-sm text-slate-400">@{member.username}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                roleStyles[member.role] || roleStyles.member
              }`}
            >
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user, updateUser, refreshUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [displayedDocs, setDisplayedDocs] = useState([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [requestActionId, setRequestActionId] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/api/documents');
      setDocuments(Array.isArray(data) ? data : []);
      if (!query.trim()) {
        setDisplayedDocs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadDocuments();
    // Intentionally depend only on the refresh tick so typing in the search box
    // does not trigger a full refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick, user?.familyId]);
  
  

  const searchDocuments = async (term) => {
    const value = term.trim();
    setQuery(term);
    setError('');

    if (!value) {
      setDisplayedDocs(documents);
      return;
    }

    setSearching(true);
    try {
      const { data } = await api.get('/api/search', { params: { q: value } });
      setDisplayedDocs(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Search failed.');
      setDisplayedDocs([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    searchDocuments(query);
  };

  const clearSearch = () => {
    setQuery('');
    setDisplayedDocs(documents);
    setError('');
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this document permanently?');
    if (!ok) return;

    try {
      await api.delete(`/api/documents/${id}`);
      setDocuments((prev) => prev.filter((doc) => doc._id !== id));
      setDisplayedDocs((prev) => prev.filter((doc) => doc._id !== id));
      setRefreshTick((t) => t + 1);
    } catch (err) {
      alert(err?.response?.data?.message || 'Delete failed.');
    }
  };

  const handleUploaded = (newDoc) => {
    if (newDoc?._id) {
      setDocuments((prev) => [newDoc, ...prev]);
      if (query.trim()) {
        searchDocuments(query);
      } else {
        setDisplayedDocs((prev) => [newDoc, ...prev]);
      }
    }
    setRefreshTick((t) => t + 1);
  };

  const handleRequestAction = async (requestId, action) => {
    setRequestActionId(requestId);
    setError('');

    try {
      const { data } = await api.post(`/api/family/${action}`, { requestId });
      if (data?.user) {
        updateUser({
          familyId: data.user.familyId,
          requests: Array.isArray(data.user.requests) ? data.user.requests : [],
        });
      } else {
        await refreshUser();
      }
      setRefreshTick((t) => t + 1);
    } catch (err) {
      setError(err?.response?.data?.message || `Failed to ${action} request.`);
    } finally {
      setRequestActionId('');
    }
  };

  const stats = useMemo(() => {
    const total = documents.length;
    const pending = documents.filter((doc) => doc.aiStatus === 'pending').length;
    const ready = documents.filter((doc) => doc.aiStatus === 'done').length;
    return { total, pending, ready };
  }, [documents]);

  const pendingRequests = Array.isArray(user?.requests)
    ? user.requests.filter((request) => request.status === 'pending')
    : [];

  return (
    <div className="min-h-screen">
      <Navbar onAddMember={user?.role === 'admin' ? () => setAddMemberOpen(true) : undefined} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Your family vault</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Search, upload, and browse sensitive family documents from one secure place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-400"
            >
              Upload document
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-400">Documents</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-400">Processing</p>
              <p className="mt-2 text-3xl font-bold text-amber-200">{stats.pending}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-400">Ready</p>
              <p className="mt-2 text-3xl font-bold text-emerald-200">{stats.ready}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents, tags, labels, categories..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 pr-28 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-2 my-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              {searching ? (
                <span className="inline-flex items-center gap-2"><Spinner /> Searching</span>
              ) : (
                'Search'
              )}
            </button>
          </form>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-200">
            {error}
          </div>
        ) : null}
        {user?.familyId && <FamilyMembersSection />}
        {user?.role === 'member' ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Family</p>
                <h3 className="mt-2 text-2xl font-bold text-white">Join Requests</h3>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-slate-300 ring-1 ring-white/10">
                {pendingRequests.length} pending
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-slate-400">No pending join requests right now.</p>
              ) : (
                pendingRequests.map((request) => (
                  <div key={request._id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{request.adminName || 'Family admin'}</p>
                      <p className="text-sm text-slate-400">Sent on {new Date(request.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={requestActionId === request._id}
                        onClick={() => handleRequestAction(request._id, 'accept')}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={requestActionId === request._id}
                        onClick={() => handleRequestAction(request._id, 'reject')}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 py-20 text-slate-300">
              <div className="flex items-center gap-3">
                <Spinner /> Loading documents...
              </div>
            </div>
          ) : displayedDocs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
              <p className="text-xl font-semibold text-white">No documents found.</p>
              <p className="mt-2 text-sm text-slate-400">
                Upload a PDF or image to start building the vault, or try a different search.
              </p>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="mt-6 rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-400"
              >
                Upload your first document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {displayedDocs.map((doc) => (
                <DocumentCard key={doc._id} document={doc} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>
      </main>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />
      <AddMemberModal open={addMemberOpen} onClose={() => setAddMemberOpen(false)} />
    </div>
  );
}
