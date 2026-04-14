import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type FormData = {
  name: string;
  display_name: string;
  description: string;
  slug: string;
  visibility: string;
  price_type: string;
  season_price_cents: number;
  currency: string;
  revenue_share_pct: number;
  payout_owner_id: string;
  status: string;
  season: string;
  start_gw: string;
  rc_offering_id: string;
  rc_entitlement_id: string;
  rc_product_id: string;
  header_image_url: string;
};

const initialForm: FormData = {
  name: '',
  display_name: '',
  description: '',
  slug: '',
  visibility: 'private',
  price_type: 'free',
  season_price_cents: 0,
  currency: 'GBP',
  revenue_share_pct: 0,
  payout_owner_id: '',
  status: 'draft',
  season: '2025-26',
  start_gw: '',
  rc_offering_id: '',
  rc_entitlement_id: '',
  rc_product_id: '',
  header_image_url: '',
};

const PRICE_TIERS = [
  {
    offeringId: 'totl_season_sub_099',
    productId: 'totl_season_sub_099',
    priceCents: 99,
    label: '£0.99 / $0.99 — Season Access',
  },
  {
    offeringId: 'totl_season_sub_199',
    productId: 'totl_season_sub_199',
    priceCents: 199,
    label: '£1.99 / $2.99 — Season Access',
  },
] as const;

function getTierByOfferingId(offeringId: string) {
  return PRICE_TIERS.find((tier) => tier.offeringId === offeringId) ?? null;
}

function getTierByPriceCents(priceCents: number) {
  return PRICE_TIERS.find((tier) => tier.priceCents === priceCents) ?? null;
}

function shouldRetryWithoutRcProductId(message: string | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('rc_product_id') && (normalized.includes('column') || normalized.includes('schema cache'));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export default function AdminLeaderboardForm() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Owner search
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerResults, setOwnerResults] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOwner, setSelectedOwner] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data, error: err } = await supabase
        .from('branded_leaderboards')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (err || !data) {
        setError('Leaderboard not found');
        setLoading(false);
        return;
      }
      setForm({
        name: data.name ?? '',
        display_name: data.display_name ?? '',
        description: data.description ?? '',
        slug: data.slug ?? '',
        visibility: data.visibility ?? 'private',
        price_type: data.price_type ?? 'free',
        season_price_cents: data.season_price_cents ?? 0,
        currency: data.currency ?? 'GBP',
        revenue_share_pct: data.revenue_share_pct ?? 0,
        payout_owner_id: data.payout_owner_id ?? '',
        status: data.status ?? 'draft',
        season: data.season ?? '2025-26',
        start_gw: data.start_gw ? String(data.start_gw) : '',
        rc_offering_id:
          data.rc_offering_id ?? (data.price_type === 'paid' ? getTierByPriceCents(data.season_price_cents ?? 0)?.offeringId ?? '' : ''),
        rc_entitlement_id: data.rc_entitlement_id ?? '',
        rc_product_id:
          data.rc_product_id ?? (data.price_type === 'paid' ? getTierByPriceCents(data.season_price_cents ?? 0)?.productId ?? '' : ''),
        header_image_url: data.header_image_url ?? '',
      });
      setSlugManuallyEdited(true);
      if (data.payout_owner_id) {
        const { data: owner } = await supabase
          .from('users')
          .select('id, name')
          .eq('id', data.payout_owner_id)
          .maybeSingle();
        if (owner) setSelectedOwner(owner);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  useEffect(() => {
    if (!ownerSearch || ownerSearch.length < 2) {
      setOwnerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', `%${ownerSearch}%`)
        .limit(10);
      setOwnerResults(data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerSearch]);

  function updateField(field: keyof FormData, value: string | number) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !slugManuallyEdited) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  function applyPriceTier(offeringId: string) {
    const tier = getTierByOfferingId(offeringId);
    if (!tier) return;
    setForm((prev) => ({
      ...prev,
      rc_offering_id: tier.offeringId,
      rc_product_id: tier.productId,
      season_price_cents: tier.priceCents,
      currency: 'GBP',
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('branded-leaderboard-headers')
      .upload(path, file, { contentType: file.type });

    if (uploadErr) {
      setError(`Upload failed: ${uploadErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('branded-leaderboard-headers')
      .getPublicUrl(path);

    setForm((prev) => ({ ...prev, header_image_url: urlData.publicUrl }));
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      ...(form.price_type === 'paid' && getTierByPriceCents(form.season_price_cents)
        ? {
            rc_offering_id: form.rc_offering_id || getTierByPriceCents(form.season_price_cents)!.offeringId,
            rc_product_id: form.rc_product_id || getTierByPriceCents(form.season_price_cents)!.productId,
          }
        : {}),
      name: form.name,
      display_name: form.display_name,
      description: form.description || null,
      slug: form.slug,
      visibility: form.visibility,
      price_type: form.price_type,
      season_price_cents: form.price_type === 'paid' ? form.season_price_cents : 0,
      currency: form.currency,
      revenue_share_pct: form.revenue_share_pct,
      payout_owner_id: form.payout_owner_id || null,
      status: form.status,
      season: form.season,
      start_gw: form.start_gw ? parseInt(form.start_gw, 10) : null,
      rc_offering_id:
        form.price_type === 'paid'
          ? form.rc_offering_id || getTierByPriceCents(form.season_price_cents)?.offeringId || null
          : null,
      rc_entitlement_id: form.rc_entitlement_id || null,
      rc_product_id:
        form.price_type === 'paid'
          ? form.rc_product_id || getTierByPriceCents(form.season_price_cents)?.productId || null
          : null,
      header_image_url: form.header_image_url || null,
      updated_at: new Date().toISOString(),
    };

    const payloadWithoutRcProductId = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== 'rc_product_id')
    );

    if (isNew) {
      let { data, error: err } = await supabase
        .from('branded_leaderboards')
        .insert(payload)
        .select('id')
        .single();
      if (err && shouldRetryWithoutRcProductId(err.message)) {
        ({ data, error: err } = await supabase
          .from('branded_leaderboards')
          .insert(payloadWithoutRcProductId)
          .select('id')
          .single());
      }
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      if (!data?.id) {
        setError('Leaderboard was created but no id was returned.');
        setSaving(false);
        return;
      }
      navigate(`/admin/leaderboards/${data.id}`);
    } else {
      let { error: err } = await supabase
        .from('branded_leaderboards')
        .update(payload)
        .eq('id', id!);
      if (err && shouldRetryWithoutRcProductId(err.message)) {
        ({ error: err } = await supabase
          .from('branded_leaderboards')
          .update(payloadWithoutRcProductId)
          .eq('id', id!));
      }
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/admin/leaderboards" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Leaderboards
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'Create Leaderboard' : 'Edit Leaderboard'}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl border border-gray-200 p-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (internal)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => updateField('display_name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => {
                if (e.target.value.length <= 140) updateField('description', e.target.value);
              }}
              maxLength={140}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              {form.description.length}/140 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                setSlugManuallyEdited(true);
                updateField('slug', e.target.value);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">URL-friendly identifier</p>
          </div>

          {/* Header image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Header Image</label>
            {form.header_image_url && (
              <div className="mb-2 rounded-lg overflow-hidden border border-gray-200" style={{ aspectRatio: '3/1' }}>
                <img
                  src={form.header_image_url}
                  alt="Header preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <p className="mt-1 text-xs text-blue-600">Uploading...</p>}
            <p className="mt-1 text-xs text-gray-500">Recommended: 1200x400 (3:1 ratio)</p>
          </div>

          {/* Settings row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => updateField('visibility', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
              <select
                value={form.price_type}
                onChange={(e) => {
                  const nextPriceType = e.target.value;
                  updateField('price_type', nextPriceType);
                  if (nextPriceType === 'paid' && !form.rc_offering_id) {
                    applyPriceTier(PRICE_TIERS[0].offeringId);
                  }
                  if (nextPriceType !== 'paid') {
                    setForm((prev) => ({
                      ...prev,
                      price_type: nextPriceType,
                      season_price_cents: 0,
                      rc_offering_id: '',
                      rc_product_id: '',
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Pricing (conditional) */}
          {form.price_type === 'paid' && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4">
              <h3 className="text-sm font-medium text-blue-900">Pricing</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Season Price Tier</label>
                <select
                  value={form.rc_offering_id}
                  onChange={(e) => {
                    applyPriceTier(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a price tier</option>
                  {PRICE_TIERS.map((tier) => (
                    <option key={tier.offeringId} value={tier.offeringId}>
                      {tier.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Paid leaderboards reuse the generic tier products. Selecting a tier auto-fills the matching RevenueCat offering and product.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RevenueCat Offering ID</label>
                  <input
                    type="text"
                    value={form.rc_offering_id}
                    onChange={(e) => updateField('rc_offering_id', e.target.value)}
                    placeholder="Auto-filled from price tier"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RevenueCat Product ID</label>
                  <input
                    type="text"
                    value={form.rc_product_id}
                    onChange={(e) => updateField('rc_product_id', e.target.value)}
                    placeholder="Auto-filled from price tier"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entitlement ID (optional)</label>
                  <input
                    type="text"
                    value={form.rc_entitlement_id}
                    onChange={(e) => updateField('rc_entitlement_id', e.target.value)}
                    placeholder="Leave blank unless intentionally configured"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Share %</label>
                  <input
                    type="number"
                    value={form.revenue_share_pct}
                    onChange={(e) => updateField('revenue_share_pct', parseFloat(e.target.value) || 0)}
                    min={0}
                    max={100}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payout Owner</label>
                  {selectedOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm flex-1">{selectedOwner.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOwner(null);
                          updateField('payout_owner_id', '');
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        placeholder="Search users..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {ownerResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {ownerResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedOwner(u);
                                updateField('payout_owner_id', u.id);
                                setOwnerSearch('');
                                setOwnerResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                              {u.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Season */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
              <input
                type="text"
                value={form.season}
                onChange={(e) => updateField('season', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Gameweek</label>
              <input
                type="number"
                value={form.start_gw}
                onChange={(e) => updateField('start_gw', e.target.value)}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Link to="/admin/leaderboards" className="text-gray-600 hover:text-gray-800">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
