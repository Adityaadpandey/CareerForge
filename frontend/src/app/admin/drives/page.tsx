"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { Plus, Building2, Trash2, CalendarDays, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

type Drive = {
  id: string;
  companyName: string;
  roles: string[];
  driveDate: string;
  eligibility: Record<string, unknown>;
};

function CreateDriveModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    companyName: "",
    driveDate: "",
    roles: "",
    minCGPA: "",
    minReadiness: "",
    branches: "",
  });

  const mutation = useMutation({
    mutationFn: (body: object) => axios.post("/api/admin/drives", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-drives"] });
      onClose();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const eligibility: Record<string, unknown> = {};
    if (form.minCGPA) eligibility.minCGPA = Number(form.minCGPA);
    if (form.minReadiness) eligibility.minReadiness = Number(form.minReadiness);
    if (form.branches.trim()) eligibility.branches = form.branches.split(",").map((b) => b.trim()).filter(Boolean);

    mutation.mutate({
      companyName: form.companyName,
      driveDate: form.driveDate,
      roles: form.roles.split(",").map((r) => r.trim()).filter(Boolean),
      eligibility,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-white">New Drive</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Company Name *</label>
            <input
              required
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              placeholder="e.g. Google, Microsoft"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Drive Date *</label>
            <input
              required
              type="date"
              value={form.driveDate}
              onChange={(e) => setForm((f) => ({ ...f, driveDate: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Roles (comma-separated)</label>
            <input
              value={form.roles}
              onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))}
              placeholder="SWE, Data Engineer, PM"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Min CGPA</label>
              <input
                type="number" step="0.1" min="0" max="10"
                value={form.minCGPA}
                onChange={(e) => setForm((f) => ({ ...f, minCGPA: e.target.value }))}
                placeholder="e.g. 7.0"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Min Readiness</label>
              <input
                type="number" min="0" max="100"
                value={form.minReadiness}
                onChange={(e) => setForm((f) => ({ ...f, minReadiness: e.target.value }))}
                placeholder="e.g. 60"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Eligible Branches (comma-separated)</label>
            <input
              value={form.branches}
              onChange={(e) => setForm((f) => ({ ...f, branches: e.target.value }))}
              placeholder="CS, IT, ECE"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-zinc-500 border border-zinc-800 hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2 rounded-lg text-sm bg-amber-500 text-black font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? "Creating…" : "Create Drive"}
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-400">Failed to create drive. Try again.</p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function AdminDrivesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<Drive[]>({
    queryKey: ["admin-drives"],
    queryFn: () => axios.get<Drive[]>("/api/admin/drives").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete("/api/admin/drives", { data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-drives"] }),
  });

  const upcoming = data.filter((d) => new Date(d.driveDate) >= new Date());
  const past = data.filter((d) => new Date(d.driveDate) < new Date());

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      {showCreate && <CreateDriveModal onClose={() => setShowCreate(false)} />}
      <main className="flex-1 p-6 md:p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
            <h1 className="text-2xl text-white font-light">Company Drives</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Drive
          </button>
        </div>

        {isLoading && <p className="text-zinc-600 text-sm">Loading…</p>}

        {!isLoading && data.length === 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-12 text-center">
            <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">No drives scheduled yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Create your first drive →
            </button>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcoming.map((d) => (
                <DriveCard key={d.id} drive={d} onDelete={() => deleteMutation.mutate(d.id)} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Past</h2>
            <div className="space-y-3 opacity-60">
              {past.map((d) => (
                <DriveCard key={d.id} drive={d} onDelete={() => deleteMutation.mutate(d.id)} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DriveCard({ drive, onDelete }: { drive: Drive; onDelete: () => void }) {
  const date = new Date(drive.driveDate);
  const isUpcoming = date >= new Date();
  // eslint-disable-next-line react-hooks/purity
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86400000);
  type Eli = { minCGPA?: number; minReadiness?: number; branches?: string[] };
  const eli = drive.eligibility as Eli;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5 flex items-start gap-4 group">
      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
        <Building2 className="w-4 h-4 text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium text-white">{drive.companyName}</h3>
          {isUpcoming && daysLeft <= 30 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {daysLeft}d away
            </span>
          )}
        </div>
        {drive.roles.length > 0 && (
          <p className="text-xs text-zinc-500 mt-0.5">{drive.roles.join(", ")}</p>
        )}
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-zinc-600">
            <CalendarDays className="w-3 h-3" />
            {date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          {eli.minCGPA != null && <span className="text-xs text-zinc-600">CGPA ≥ {eli.minCGPA}</span>}
          {eli.minReadiness != null && <span className="text-xs text-zinc-600">Readiness ≥ {eli.minReadiness}</span>}
          {eli.branches && eli.branches.length > 0 && (
            <span className="text-xs text-zinc-600">{eli.branches.join(", ")}</span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
