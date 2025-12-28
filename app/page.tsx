'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useLiff } from '@/components/LiffProvider';
import { Trophy, BookOpen, Plus, Clock } from 'lucide-react';

interface LeaderboardUser {
  id: string;
  display_name: string;
  avatar_url: string;
  score: number;
}

export default function Home() {
  const { profile, error: liffError } = useLiff();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('score', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else if (data) {
        setLeaderboard(data as LeaderboardUser[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header / User Profile Summary */}
      <div className="bg-white p-6 shadow-sm rounded-b-3xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Bible Tracker ✝️</h1>
            <Link href="/history" className="flex items-center gap-2 p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200">
              <Clock size={20} />
              <p>ดูประวัติ</p>
            </Link>
          </div>
          {profile && (
            <div className="flex items-center gap-2">
              {profile.avatar_url && (
                <img src={profile.avatar_url} alt="Profile" className="w-8 h-8 rounded-full" />
              )}
            </div>
          )}
        </div>

        {profile ? (
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-16 h-16 rounded-full border-4 border-white/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-400 flex items-center justify-center border-4 border-white/20">
                  <span className="text-2xl font-bold">{profile.display_name?.[0]}</span>
                </div>
              )}

              <div>
                <p className="text-blue-100 text-sm">ยินดีต้อนรับ,</p>
                <h2 className="text-xl font-bold">{profile.display_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Trophy size={12} />
                    {(leaderboard.find(u => u.id === profile.id)?.score || 0)} คะแนน
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-100 rounded-2xl p-6 text-slate-500 text-center">
            {liffError ? <p className="text-red-500">{liffError}</p> : <p>กำลังโหลดข้อมูลผู้ใช้...</p>}
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4">
        {/* Leaderboard Section */}
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-yellow-500" />
          <h2 className="text-lg font-bold text-slate-800">กระดานผู้นำ</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">กำลังโหลดอันดับ...</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ยังไม่มีใครบันทึก เป็นคนแรกสิ!</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {leaderboard.map((user, index) => (
                <div key={user.id} className={`flex items-center p-4 ${user.id === profile?.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold mr-4 shrink-0 
                    ${index === 0 ? 'bg-yellow-100 text-yellow-600' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' : 'text-slate-400 font-medium'
                    }`}>
                    {index + 1}
                  </div>

                  <div className="mr-3 shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full bg-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                        {user.display_name?.[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{user.display_name}</p>
                    {user.id === profile?.id && <p className="text-xs text-blue-600">คุณ</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-lg text-sm font-bold">
                      <BookOpen size={14} />
                      {user.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB - Floating Action Button */}
      <Link
        href="/record"
        className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 transition-colors z-50 hover:scale-105 active:scale-95"
      >
        <Plus size={28} />
      </Link>
    </div>
  );
}