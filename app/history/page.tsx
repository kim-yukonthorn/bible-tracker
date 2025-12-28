'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLiff } from '@/components/LiffProvider';
import { ArrowLeft, Trash2, ChevronLeft, ChevronRight, BookOpen, X } from 'lucide-react';
import { bibleBooks } from '@/data/bible';

interface ReadingLog {
    id: number;
    book_name: string;
    chapter: number;
    created_at: string;
}

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function toThaiYear(year: number) {
    return year + 543;
}

// Helper to get local date key (YYYY-MM-DD) from Date object
function getLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function HistoryPage() {
    const router = useRouter();
    const { profile } = useLiff();
    const [logs, setLogs] = useState<ReadingLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

    // Group logs by date string (YYYY-MM-DD) using LOCAL timezone
    const logsByDate = useMemo(() => {
        const grouped: Record<string, ReadingLog[]> = {};
        logs.forEach(log => {
            const logDate = new Date(log.created_at);
            const dateKey = getLocalDateKey(logDate);
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(log);
        });
        return grouped;
    }, [logs]);

    // Generate calendar days for current month
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: (Date | null)[] = [];

        // Add empty slots for days before first day of month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d));
        }

        return days;
    }, [currentMonth]);

    const navigateMonth = (delta: number) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
        setSelectedDate(null);
    };

    const getDateStatus = (date: Date): 'read' | 'unread' | 'future' => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (checkDate > today) return 'future';

        const dateKey = getLocalDateKey(date);
        return logsByDate[dateKey] ? 'read' : 'unread';
    };

    const getLogsForDate = (date: Date): ReadingLog[] => {
        const dateKey = getLocalDateKey(date);
        const logsForDate = logsByDate[dateKey] || [];

        // Sort by book order (according to bible.ts) then by chapter
        return [...logsForDate].sort((a, b) => {
            const bookIndexA = bibleBooks.findIndex(book => book.name === a.book_name);
            const bookIndexB = bibleBooks.findIndex(book => book.name === b.book_name);

            if (bookIndexA !== bookIndexB) {
                return bookIndexA - bookIndexB;
            }
            return a.chapter - b.chapter;
        });
    };

    const handleDelete = async (logId: number) => {
        if (!confirm('คุณต้องการลบรายการนี้ใช่ไหม? (คะแนนจะลดลง 1)')) return;

        try {
            const { error: deleteError } = await supabase
                .from('reading_logs')
                .delete()
                .eq('id', logId);

            if (deleteError) throw deleteError;

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

            setLogs(prev => prev.filter(l => l.id !== logId));

        } catch (err: unknown) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    if (!profile) {
        return <div className="p-8 text-center text-slate-400">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">ประวัติการอ่าน</h1>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {loading ? (
                    <div className="text-center text-slate-400 py-10">กำลังโหลด...</div>
                ) : (
                    <>
                        {/* Month Navigation */}
                        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => navigateMonth(-1)}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <h2 className="text-lg font-bold text-slate-800">
                                    {THAI_MONTHS[currentMonth.getMonth()]} {toThaiYear(currentMonth.getFullYear())}
                                </h2>
                                <button
                                    onClick={() => navigateMonth(1)}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {THAI_DAYS.map(day => (
                                    <div key={day} className="text-center text-xs font-medium text-slate-400 py-2">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((date, idx) => {
                                    if (!date) {
                                        return <div key={`empty-${idx}`} className="aspect-square" />;
                                    }

                                    const status = getDateStatus(date);
                                    const isSelected = selectedDate?.toDateString() === date.toDateString();
                                    const todayHighlight = isToday(date);

                                    return (
                                        <button
                                            key={date.toISOString()}
                                            onClick={() => setSelectedDate(date)}
                                            className={`
                                                aspect-square rounded-xl flex flex-col items-center justify-center
                                                transition-all text-sm font-medium relative
                                                ${isSelected
                                                    ? 'bg-blue-500 text-white shadow-md scale-105'
                                                    : todayHighlight
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'hover:bg-slate-100 text-slate-700'
                                                }
                                            `}
                                        >
                                            <span>{date.getDate()}</span>
                                            {/* Status Dot */}
                                            <span className={`
                                                w-1.5 h-1.5 rounded-full absolute bottom-1
                                                ${status === 'read'
                                                    ? 'bg-green-500'
                                                    : status === 'unread'
                                                        ? 'bg-red-400'
                                                        : 'bg-transparent'
                                                }
                                                ${isSelected && status === 'read' ? 'bg-green-300' : ''}
                                                ${isSelected && status === 'unread' ? 'bg-red-300' : ''}
                                            `} />
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>อ่านแล้ว</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-red-400" />
                                    <span>ยังไม่ได้อ่าน</span>
                                </div>
                            </div>
                        </div>

                        {/* Selected Date Details */}
                        {selectedDate && (
                            <div className="bg-white rounded-2xl shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800">
                                        📖 วันที่ {selectedDate.getDate()} {THAI_MONTHS[selectedDate.getMonth()]}
                                    </h3>
                                    <button
                                        onClick={() => setSelectedDate(null)}
                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {getLogsForDate(selectedDate).length === 0 ? (
                                    <div className="text-center text-slate-400 py-6">
                                        ไม่มีการอ่านในวันนี้
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {getLogsForDate(selectedDate).map(log => (
                                            <div
                                                key={log.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <BookOpen size={16} className="text-blue-500" />
                                                    <span className="font-medium text-slate-800">{log.book_name}</span>
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                                        บทที่ {log.chapter}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stats Summary */}
                        <div className="mt-4 text-center text-sm text-slate-500">
                            รวมทั้งหมด {logs.length} รายการ
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
