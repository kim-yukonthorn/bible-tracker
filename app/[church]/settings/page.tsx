'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiff, Church } from '@/components/LiffProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';

export default function ChurchSettings() {
  const router = useRouter();
  const params = useParams();
  const slug = params.church as string;
  const { memberships, isInitializing } = useLiff();

  const membership = memberships.find(m => m.church.slug === slug);
  const church = membership?.church;
  const isAdmin = membership?.role === 'admin';

  // Only admins of this church may be here.
  useEffect(() => {
    if (!isInitializing && (!membership || !isAdmin)) {
      router.replace(`/${slug}`);
    }
  }, [isInitializing, membership, isAdmin, router, slug]);

  if (isInitializing || !church || !isAdmin) {
    return <LoadingScreen />;
  }

  // Keyed by church.id so form state initializes from the loaded church.
  return <SettingsForm key={church.id} church={church} slug={slug} />;
}

function SettingsForm({ church, slug }: { church: Church; slug: string }) {
  const router = useRouter();
  const { db, refreshMemberships } = useLiff();

  const [name, setName] = useState(church.name);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('กรุณากรอกชื่อคริสตจักร');
      return;
    }
    setSaving(true);
    const { error: updateError } = await db
      .from('churches')
      .update({ name: name.trim() })
      .eq('id', church.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refreshMemberships();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyCode() {
    navigator.clipboard.writeText(church.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.push(`/${slug}`)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">แก้ไขคริสตจักร</h1>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ชื่อคริสตจักร</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">ID คริสตจักร (เปลี่ยนไม่ได้)</label>
            <input
              value={church.slug}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <label className="block text-sm text-slate-600 mb-1">รหัสเข้าร่วม (แชร์ให้สมาชิก)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 font-mono tracking-widest text-slate-800">
              {church.join_code}
            </code>
            <button
              onClick={copyCode}
              className="p-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="คัดลอกรหัส"
            >
              {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
