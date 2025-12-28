'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLiff } from '@/components/LiffProvider';
import { ArrowLeft, Trash2, Calendar, BookOpen } from 'lucide-react';

interface ReadingLog {
    id: number;
    book_name: string;
    chapter: number;
    created_at: string;
}

export default function HistoryPage() {
    const router = useRouter();
    const { profile } = useLiff();
    const [logs, setLogs] = useState<ReadingLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!profile) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('reading_logs')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching history:', error);
            } else {
                setLogs(data || []);
            }
            setLoading(false);
        };

        fetchHistory();
    }, [profile]);

    const handleDelete = async (logId: number) => {
        if (!confirm('คุณต้องการลบรายการนี้ใช่ไหม? (คะแนนจะลดลง 1)')) return;

        try {
            // 1. Delete log
            const { error: deleteError } = await supabase
                .from('reading_logs')
                .delete()
                .eq('id', logId);

            if (deleteError) throw deleteError;

            // 2. Decrement score
            // Safe decrement via RPC would be better, but fetching current score is MVP way
            const { data: user } = await supabase
                .from('profiles')
                .select('score')
                .eq('id', profile?.id)
                .single();

            if (user) {
                await supabase
                    .from('profiles')
                    .update({ score: Math.max(0, user.score - 1) })
                    .eq('id', profile?.id);
            }

            // 3. Update UI
            setLogs(prev => prev.filter(l => l.id !== logId));

        } catch (err: unknown) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    if (!profile) {
        return <div className="p-8 text-center text-slate-400">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">ประวัติการอ่าน ({logs.length})</h1>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {loading ? (
                    <div className="text-center text-slate-400 py-10">กำลังโหลด...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">ยังไม่มีประวัติการอ่าน</div>
                ) : (
                    <div className="space-y-3">
                        {logs.map(log => (
                            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <BookOpen size={16} className="text-blue-500" />
                                        <span className="font-bold text-slate-800 text-lg">{log.book_name}</span>
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm font-bold">บทที่ {log.chapter}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                                        <Calendar size={12} />
                                        {new Date(log.created_at).toLocaleString('th-TH')}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(log.id)}
                                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
