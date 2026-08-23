"use client";

import { useState } from "react";
import {
  createAd,
  updateAd,
  setAdActive,
  deleteAd,
  type SerializedAd,
} from "../actions";

export type AdsManagerAd = SerializedAd;

type FormState = {
  advertiser: string;
  headline: string;
  targetUrl: string;
  placement: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: FormState = {
  advertiser: "",
  headline: "",
  targetUrl: "https://",
  placement: "FEED",
  startsAt: "",
  endsAt: "",
};

function toFormValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function ctr(clicks: number, impressions: number) {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

// Admin CRUD for sponsored placements. Real counters only — CTR is shown
// as "—" until at least one impression exists, never faked.
export function AdsManager({ initial }: { initial: AdsManagerAd[] }) {
  const [ads, setAds] = useState<AdsManagerAd[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [image, setImage] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function readForm(f: FormState): FormData {
    const fd = new FormData();
    fd.set("advertiser", f.advertiser);
    fd.set("headline", f.headline);
    fd.set("targetUrl", f.targetUrl);
    fd.set("placement", f.placement);
    fd.set("startsAt", f.startsAt);
    fd.set("endsAt", f.endsAt);
    return fd;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    const fd = readForm(form);
    if (image) fd.set("image", image);
    try {
      const res = await createAd(fd);
      if (res.ok && res.ad) {
        setAds((prev) => [res.ad!, ...prev]);
        setForm(EMPTY_FORM);
        setImage(null);
      } else {
        setCreateError(res.error || "Create failed");
      }
    } finally {
      setCreating(false);
    }
  }

  async function onSaveEdit(id: string) {
    if (busyId) return;
    setBusyId(id);
    setEditError(null);
    const fd = readForm(editForm);
    if (editImage) fd.set("image", editImage);
    try {
      const res = await updateAd(id, fd);
      if (res.ok && res.ad) {
        setAds((prev) => prev.map((a) => (a.id === id ? res.ad! : a)));
        setEditingId(null);
      } else {
        setEditError(res.error || "Update failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleActive(a: AdsManagerAd) {
    if (busyId) return;
    setBusyId(a.id);
    try {
      const res = await setAdActive(a.id, !a.active);
      if (res.ok) setAds((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(a: AdsManagerAd) {
    if (busyId) return;
    if (
      !window.confirm(
        `Delete the "${a.headline.slice(0, 60)}" ad permanently? Counters go with it.`
      )
    )
      return;
    setBusyId(a.id);
    try {
      const res = await deleteAd(a.id);
      if (res.ok) setAds((prev) => prev.filter((x) => x.id !== a.id));
    } finally {
      setBusyId(null);
    }
  }

  const inputCls = "input";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1";

  function renderFields(state: FormState, setState: (f: FormState) => void, fileState: File | null, setFile: (f: File | null) => void) {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Advertiser</label>
            <input
              className={inputCls}
              value={state.advertiser}
              maxLength={80}
              onChange={(e) => setState({ ...state, advertiser: e.target.value })}
              placeholder="Acme Labs"
            />
          </div>
          <div>
            <label className={labelCls}>Placement</label>
            <select
              className={inputCls}
              value={state.placement}
              onChange={(e) => setState({ ...state, placement: e.target.value })}
            >
              <option value="FEED">FEED</option>
              <option value="SIDEBAR">SIDEBAR</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls}>Headline ({state.headline.length}/200)</label>
          <input
            className={inputCls}
            value={state.headline}
            maxLength={200}
            onChange={(e) => setState({ ...state, headline: e.target.value })}
            placeholder="What the ad says"
          />
        </div>
        <div className="mt-3">
          <label className={labelCls}>Target URL (https only)</label>
          <input
            className={inputCls}
            value={state.targetUrl}
            onChange={(e) => setState({ ...state, targetUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Starts at (optional)</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={state.startsAt}
              onChange={(e) => setState({ ...state, startsAt: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Ends at (optional)</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={state.endsAt}
              onChange={(e) => setState({ ...state, endsAt: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls}>Image (optional, max 5MB)</label>
          <input
            type="file"
            accept="image/*"
            className="block w-full text-sm text-ink-muted"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {fileState && (
            <p className="mt-1 text-xs text-ink-muted">{fileState.name}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <div>
      {/* Create */}
      <section className="card mb-8 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-ink-muted">
          Create ad
        </h2>
        <form onSubmit={onCreate}>
          {renderFields(form, setForm, image, setImage)}
          {createError && (
            <p className="mt-3 text-sm font-medium text-warm">{createError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="btn-primary mt-4 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create ad"}
          </button>
        </form>
      </section>

      {/* Existing ads */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-muted">
        {ads.length === 0 ? "No ads yet." : `Ads (${ads.length})`}
      </h2>
      <div className="space-y-4">
        {ads.map((a) =>
          editingId === a.id ? (
            <section key={a.id} className="card p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-accent">
                Editing · {a.advertiser}
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveEdit(a.id);
                }}
              >
                {renderFields(editForm, setEditForm, editImage, setEditImage)}
                {editError && (
                  <p className="mt-3 text-sm font-medium text-warm">{editError}</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busyId === a.id}
                    className="btn-primary disabled:opacity-50"
                  >
                    {busyId === a.id ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <article key={a.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        a.active
                          ? "bg-accent-tint text-accent"
                          : "bg-soft text-ink-muted"
                      }`}
                    >
                      {a.active ? "Active" : "Paused"}
                    </span>
                    <span className="badge bg-soft text-ink-muted">{a.placement}</span>
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug text-ink">
                    {a.headline}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {a.advertiser} ·{" "}
                    <a
                      href={a.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-deep hover:underline"
                    >
                      {a.targetUrl}
                    </a>
                  </p>
                  {(a.startsAt || a.endsAt) && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Window:{" "}
                      {a.startsAt
                        ? new Date(a.startsAt).toLocaleString()
                        : "now"}{" "}
                      →{" "}
                      {a.endsAt ? new Date(a.endsAt).toLocaleString() : "open end"}
                    </p>
                  )}
                </div>

                {/* Real counters only */}
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-ink">{a.impressions}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                      Impressions
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">{a.clicks}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                      Clicks
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-ink">
                      {ctr(a.clicks, a.impressions)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-faint">
                      CTR
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => onToggleActive(a)}
                  className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {a.active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => {
                    setEditingId(a.id);
                    setEditError(null);
                    setEditImage(null);
                    setEditForm({
                      advertiser: a.advertiser,
                      headline: a.headline,
                      targetUrl: a.targetUrl,
                      placement: a.placement,
                      startsAt: toFormValue(a.startsAt),
                      endsAt: toFormValue(a.endsAt),
                    });
                  }}
                  className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => onDelete(a)}
                  className="ml-auto rounded-lg border border-warm px-3 py-1.5 text-xs font-semibold text-warm transition hover:bg-warm-tint disabled:opacity-50"
                >
                  Delete ad
                </button>
              </div>
            </article>
          )
        )}
      </div>
    </div>
  );
}
