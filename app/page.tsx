'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/components/LiffProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { Church, Plus, LogIn, Loader2 } from 'lucide-react';

function deriveSlug(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export default function RegisterChurch() {
  const router = useRouter();
  const { profile, db, memberships, isInitializing, error: liffError, refreshMemberships } = useLiff();

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');

  // Create form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  // Join form
  const [joinCode, setJoinCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : deriveSlug(name)),
    [slug, slugTouched, name],
  );

  // Redirect users who already belong to a church.
  useEffect(() => {
    if (!isInitializing && memberships.length > 0) {
      router.replace(`/${memberships[0].church.slug}`);
    }
  }, [isInitializing, memberships, router]);

  // Live slug availability check (debounced). All status updates happen inside
  // the timeout callback to avoid synchronous setState within the effect body.
  useEffect(() => {
    if (mode !== 'create') return;
    const value = effectiveSlug;
    const t = setTimeout(async () => {
      if (!value) {
        setSlugStatus('idle');
        return;
      }
      if (!/^[A-Z0-9]{1,5}$/.test(value)) {
        setSlugStatus('invalid');
        return;
      }
      setSlugStatus('checking');
      const { data, error } = await db.rpc('slug_available', { p_slug: value });
      setSlugStatus(error ? 'idle' : data ? 'ok' : 'taken');
    }, 300);
    return () => clearTimeout(t);
  }, [effectiveSlug, mode, db]);

  async function handleCreate() {
    setFormError(null);
    if (!name.trim()) {
      setFormError('กรุณากรอกชื่อคริสตจักร');
      return;
    }
    if (!/^[A-Z0-9]{1,5}$/.test(effectiveSlug)) {
      setFormError('ID คริสตจักรต้องเป็นภาษาอังกฤษหรือตัวเลข 1-5 ตัว');
      return;
    }
    setSubmitting(true);
    const { data, error } = await db.rpc('create_church', {
      p_name: name.trim(),
      p_slug: effectiveSlug,
    });
    setSubmitting(false);
    if (error || !data) {
      setFormError(error?.message?.includes('already taken')
        ? `ID คริสตจักร "${effectiveSlug}" ถูกใช้แล้ว`
        : (error?.message ?? 'สร้างคริสตจักรไม่สำเร็จ'));
      return;
    }
    await refreshMemberships();
    router.replace(`/${data.slug}`);
  }

  async function handleJoin() {
    setFormError(null);
    if (!joinCode.trim()) {
      setFormError('กรุณากรอกรหัสเข้าร่วม');
      return;
    }
    setSubmitting(true);
    const { data, error } = await db.rpc('join_church', { p_code: joinCode.trim() });
    setSubmitting(false);
    if (error || !data) {
      setFormError(error?.message?.includes('invalid join code')
        ? 'รหัสเข้าร่วมไม่ถูกต้อง'
        : (error?.message ?? 'เข้าร่วมไม่สำเร็จ'));
      return;
    }
    await refreshMemberships();
    router.replace(`/${data.slug}`);
  }

  if (isInitializing || memberships.length > 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Bible Tracker ✝️</h1>
          <p className="text-slate-500 mt-2">
            {profile ? `สวัสดี ${profile.display_name}` : 'ยินดีต้อนรับ'}
          </p>
        </div>

        {liffError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">{liffError}</div>
        )}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">{formError}</div>
        )}

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center gap-3 p-5 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Plus />
              </div>
              <div>
                <p className="font-bold text-slate-800">สร้างคริสตจักรใหม่</p>
                <p className="text-sm text-slate-500">คุณจะเป็นผู้ดูแล (แอดมิน)</p>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full flex items-center gap-3 p-5 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <LogIn />
              </div>
              <div>
                <p className="font-bold text-slate-800">เข้าร่วมคริสตจักร</p>
                <p className="text-sm text-slate-500">ใช้รหัสเข้าร่วมจากแอดมิน</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Church size={20} className="text-blue-600" /> สร้างคริสตจักรใหม่
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">ชื่อคริสตจักร</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="เช่น Faith Baptist Church"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                ID คริสตจักร (ใช้ในลิงก์ /{effectiveSlug || '...'})
              </label>
              <input
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5));
                }}
                maxLength={5}
                placeholder="ABC12"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
              />
              <p className="text-xs mt-1 h-4">
                {slugStatus === 'checking' && <span className="text-slate-400">กำลังตรวจสอบ...</span>}
                {slugStatus === 'ok' && <span className="text-green-600">ใช้ได้</span>}
                {slugStatus === 'taken' && <span className="text-red-500">ถูกใช้แล้ว</span>}
                {slugStatus === 'invalid' && <span className="text-red-500">ใช้ A-Z, 0-9 ได้ 1-5 ตัว</span>}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMode('choose')}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || slugStatus === 'taken' || slugStatus === 'invalid'}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                สร้าง
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <LogIn size={20} className="text-green-600" /> เข้าร่วมคริสตจักร
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">รหัสเข้าร่วม</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-200 font-mono tracking-widest"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setMode('choose')}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleJoin}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                เข้าร่วม
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
