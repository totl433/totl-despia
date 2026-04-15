import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Host = { id: string; user_id: string; display_order: number; name: string | null; avatar_url: string | null };
type JoinCode = { id: string; code: string; active: boolean; expires_at: string | null; max_uses: number | null; use_count: number; created_at: string };
type Leaderboard = Record<string, any>;

const JOIN_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3,50}$/;

function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase();
}

async function sendHostReviewReadyEmail(leaderboardId: string, hostUserId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.warn('[AdminLeaderboardDetail] No session token available for host review email');
    return;
  }

  const envBff = typeof import.meta.env.VITE_BFF_URL === 'string' ? import.meta.env.VITE_BFF_URL.trim() : '';
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const productionBase = 'https://totl-despia-production.up.railway.app';
  const primaryBase = envBff || (isDevelopment ? 'http://localhost:8787' : productionBase);
  const primaryUrl = `${primaryBase.replace(/\/$/, '')}/v1/admin/branded-leaderboards/${encodeURIComponent(leaderboardId)}/notify-host-review`;
  const fallbackUrl = `${productionBase}/v1/admin/branded-leaderboards/${encodeURIComponent(leaderboardId)}/notify-host-review`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };

  let response: Response;
  try {
    response = await fetch(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ hostUserId }),
    });
  } catch (error) {
    if (!isDevelopment || primaryBase === productionBase) throw error;
    console.warn('[AdminLeaderboardDetail] Local BFF unavailable, trying production host review email endpoint', error);
    response = await fetch(fallbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ hostUserId }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Host review email failed: ${response.status} ${errorText}`);
  }
}

async function getAdminBffRequestContext() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No session token available for admin host request');
  }

  const envBff = typeof import.meta.env.VITE_BFF_URL === 'string' ? import.meta.env.VITE_BFF_URL.trim() : '';
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const productionBase = 'https://totl-despia-production.up.railway.app';
  const primaryBase = envBff || (isDevelopment ? 'http://localhost:8787' : productionBase);

  return {
    isDevelopment,
    primaryBase,
    productionBase,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  };
}

async function requestAdminHostMutation(init: { method: 'POST' | 'DELETE'; path: string; body?: unknown }) {
  const { isDevelopment, primaryBase, productionBase, headers } = await getAdminBffRequestContext();
  const primaryUrl = `${primaryBase.replace(/\/$/, '')}${init.path}`;
  const fallbackUrl = `${productionBase}${init.path}`;
  const requestInit: RequestInit = {
    method: init.method,
    headers,
  };

  if (typeof init.body !== 'undefined') {
    requestInit.body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(primaryUrl, requestInit);
  } catch (error) {
    if (!isDevelopment || primaryBase === productionBase) throw error;
    console.warn('[AdminLeaderboardDetail] Local BFF unavailable, retrying host mutation via production', error);
    response = await fetch(fallbackUrl, requestInit);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Host mutation failed: ${response.status} ${errorText}`);
  }
}

export default function AdminLeaderboardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lb, setLb] = useState<Leaderboard | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [codes, setCodes] = useState<JoinCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Host search
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState<Array<{ id: string; name: string }>>([]);

  // Code generation
  const [generatingCode, setGeneratingCode] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [savingCodeId, setSavingCodeId] = useState<string | null>(null);

  async function loadData() {
    const [lbRes, hostsRes, codesRes] = await Promise.all([
      supabase.from('branded_leaderboards').select('*').eq('id', id!).maybeSingle(),
      supabase.from('branded_leaderboard_hosts').select('*, users:user_id(id, name, avatar_url)').eq('leaderboard_id', id!).order('display_order'),
      supabase.from('branded_leaderboard_join_codes').select('*').eq('leaderboard_id', id!).order('created_at', { ascending: false }),
    ]);
    if (lbRes.data) setLb(lbRes.data);
    setHosts(
      (hostsRes.data ?? []).map((h: any) => ({
        id: h.id,
        user_id: h.user_id,
        display_order: h.display_order,
        name: h.users?.name ?? null,
        avatar_url: h.users?.avatar_url ?? null,
      }))
    );
    setCodes(codesRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (!hostSearch || hostSearch.length < 2) { setHostResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id, name').ilike('name', `%${hostSearch}%`).limit(10);
      setHostResults(data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [hostSearch]);

  async function addHost(userId: string) {
    const nextOrder = hosts.length;
    try {
      await requestAdminHostMutation({
        method: 'POST',
        path: `/v1/admin/branded-leaderboards/${encodeURIComponent(id!)}/hosts`,
        body: {
          user_id: userId,
          display_order: nextOrder,
        },
      });
    } catch (error: any) {
      alert(error?.message ?? 'Could not add host.');
      return;
    }
    setHostSearch('');
    setHostResults([]);
    void sendHostReviewReadyEmail(id!, userId).catch((err) => {
      console.warn('[AdminLeaderboardDetail] Host added but review email failed', err);
    });
    loadData();
  }

  async function removeHost(hostId: string) {
    try {
      await requestAdminHostMutation({
        method: 'DELETE',
        path: `/v1/admin/branded-leaderboards/${encodeURIComponent(id!)}/hosts/${encodeURIComponent(hostId)}`,
      });
    } catch (error: any) {
      alert(error?.message ?? 'Could not remove host.');
      return;
    }
    loadData();
  }

  function generateCode(len = 5): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function createJoinCode() {
    setGeneratingCode(true);
    const { data: { user } } = await supabase.auth.getUser();
    const code = generateCode();
    await supabase.from('branded_leaderboard_join_codes').insert({
      code,
      leaderboard_id: id,
      created_by: user?.id ?? null,
    });
    setGeneratingCode(false);
    loadData();
  }

  async function toggleCodeActive(codeId: string, active: boolean) {
    await supabase.from('branded_leaderboard_join_codes').update({ active }).eq('id', codeId);
    loadData();
  }

  function beginEditCode(code: JoinCode) {
    setEditingCodeId(code.id);
    setEditingCodeValue(code.code);
    setCodeError(null);
  }

  function cancelEditCode() {
    setEditingCodeId(null);
    setEditingCodeValue('');
    setCodeError(null);
  }

  async function saveCode(codeId: string) {
    const normalized = normalizeJoinCode(editingCodeValue);
    if (!JOIN_CODE_REGEX.test(normalized)) {
      setCodeError('Codes must be 3-50 characters and use only A-Z letters and digits 2-9.');
      return;
    }

    setSavingCodeId(codeId);
    setCodeError(null);
    const { error } = await supabase
      .from('branded_leaderboard_join_codes')
      .update({ code: normalized })
      .eq('id', codeId);

    setSavingCodeId(null);

    if (error) {
      if ((error as any)?.code === '23505') {
        setCodeError('That join code is already taken.');
        return;
      }
      setCodeError(error.message ?? 'Could not update join code.');
      return;
    }

    cancelEditCode();
    loadData();
  }

  async function deleteLeaderboard() {
    if (!confirm('Are you sure? This will delete the leaderboard and all associated data.')) return;
    await supabase.from('branded_leaderboards').delete().eq('id', id!);
    navigate('/admin/leaderboards');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!lb) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Leaderboard not found</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-red-100 text-red-700',
  };
  const codesByOldestFirst = [...codes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const defaultCode = codesByOldestFirst[0] ?? null;
  const secondaryCodes = codes.filter((c) => c.id !== defaultCode?.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/admin/leaderboards" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Leaderboards
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {lb.header_image_url && (
            <div className="mb-4 rounded-lg overflow-hidden" style={{ aspectRatio: '3/1' }}>
              <img src={lb.header_image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{lb.display_name}</h1>
              <p className="text-gray-500 mt-1">/{lb.slug}</p>
              {lb.description && <p className="text-gray-600 mt-2">{lb.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[lb.status] ?? ''}`}>
                {lb.status}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {lb.price_type}
              </span>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              to={`/admin/leaderboards/${id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Edit
            </Link>
            <Link
              to={`/admin/leaderboards/${id}/revenue`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Revenue
            </Link>
            <button
              onClick={deleteLeaderboard}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Hosts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hosts</h2>

          {hosts.length > 0 && (
            <div className="space-y-2 mb-4">
              {hosts.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {h.avatar_url ? (
                      <img src={h.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        {(h.name ?? '?')[0]}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{h.name ?? 'Unknown'}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      HOST
                    </span>
                  </div>
                  <button
                    onClick={() => removeHost(h.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={hostSearch}
              onChange={(e) => setHostSearch(e.target.value)}
              placeholder="Search users to add as host..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {hostResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {hostResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addHost(u.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Join Codes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Join Codes</h2>
            <button
              onClick={createJoinCode}
              disabled={generatingCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {generatingCode ? 'Generating...' : 'Generate Code'}
            </button>
          </div>

          {codes.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No join codes yet</p>
          ) : (
            <div className="space-y-4">
              {defaultCode ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Default Code</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                      Editable
                    </span>
                  </div>
                  <div key={defaultCode.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      {editingCodeId === defaultCode.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            value={editingCodeValue}
                            onChange={(e) => setEditingCodeValue(normalizeJoinCode(e.target.value))}
                            className="px-3 py-1.5 border border-gray-300 rounded-md font-mono font-bold tracking-wider uppercase"
                            placeholder="ENTERCODE"
                            autoFocus
                          />
                          {codeError ? <p className="text-xs text-red-600">{codeError}</p> : null}
                        </div>
                      ) : (
                        <code className="text-lg font-mono font-bold text-gray-900 tracking-wider">{defaultCode.code}</code>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${defaultCode.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {defaultCode.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {defaultCode.use_count} uses{defaultCode.max_uses ? ` / ${defaultCode.max_uses}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingCodeId === defaultCode.id ? (
                        <>
                          <button
                            onClick={() => saveCode(defaultCode.id)}
                            disabled={savingCodeId === defaultCode.id}
                            className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                          >
                            {savingCodeId === defaultCode.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditCode}
                            disabled={savingCodeId === defaultCode.id}
                            className="text-gray-600 hover:text-gray-800 text-sm disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => beginEditCode(defaultCode)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(defaultCode.code)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Copy
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleCodeActive(defaultCode.id, !defaultCode.active)}
                        disabled={savingCodeId === defaultCode.id}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        {defaultCode.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {secondaryCodes.length > 0 ? (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Additional Codes</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                      Read-only
                    </span>
                  </div>
                  <div className="space-y-2">
                    {secondaryCodes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <code className="text-lg font-mono font-bold text-gray-900 tracking-wider">{c.code}</code>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {c.use_count} uses{c.max_uses ? ` / ${c.max_uses}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigator.clipboard.writeText(c.code)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => toggleCodeActive(c.id, !c.active)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            {c.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
