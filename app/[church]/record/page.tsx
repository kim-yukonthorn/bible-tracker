'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiff } from '@/components/LiffProvider';
import { bibleBooks } from '@/data/bible';
import { ArrowLeft, Check, ChevronRight, CheckCircle } from 'lucide-react';

interface ReadingLog {
    book_name: string;
    chapter: number;
}

export default function RecordPage() {
    const router = useRouter();
    const params = useParams();
    const slug = params.church as string;
    const { profile, db } = useLiff();

    const [selectedBookIndex, setSelectedBookIndex] = useState<number | null>(null);
    const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [readLogs, setReadLogs] = useState<ReadingLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    const selectedBook = selectedBookIndex !== null ? bibleBooks[selectedBookIndex] : null;

    useEffect(() => {
        if (profile) {
            fetchReadLogs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    async function fetchReadLogs() {
        if (!profile) return;
        setLoadingLogs(true);
        try {
            const { data, error } = await db
                .from('reading_logs')
                .select('book_name, chapter')
                .eq('user_id', profile.id);

            if (error) {
                console.error('Error fetching reading logs:', error);
            } else if (data) {
                setReadLogs(data);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoadingLogs(false);
        }
    }

    const getReadChaptersForBook = (bookName: string): number[] => {
        return readLogs.filter(log => log.book_name === bookName).map(log => log.chapter);
    };

    const getReadCountForBook = (bookName: string): number => {
        return readLogs.filter(log => log.book_name === bookName).length;
    };

    const [lastClickedChapter, setLastClickedChapter] = useState<number | null>(null);

    const handleBookSelect = (index: number) => {
        setSelectedBookIndex(index);
        setSelectedChapters([]);
        setLastClickedChapter(null);
    };

    const toggleChapter = (chapter: number) => {
        if (selectedChapters.includes(chapter)) {
            setSelectedChapters(prev => prev.filter(c => c !== chapter));
            setLastClickedChapter(null);
            return;
        }

        if (lastClickedChapter !== null && lastClickedChapter !== chapter) {
            const start = Math.min(lastClickedChapter, chapter);
            const end = Math.max(lastClickedChapter, chapter);

            const readChapters = selectedBook ? getReadChaptersForBook(selectedBook.name) : [];
            const rangeChapters: number[] = [];

            for (let i = start; i <= end; i++) {
                if (!readChapters.includes(i)) {
                    rangeChapters.push(i);
                }
            }

            setSelectedChapters(prev => {
                const combined = new Set([...prev, ...rangeChapters]);
                return Array.from(combined).sort((a, b) => a - b);
            });
            setLastClickedChapter(null);
        } else {
            setSelectedChapters(prev => [...prev, chapter].sort((a, b) => a - b));
            setLastClickedChapter(chapter);
        }
    };

    const handleSubmit = async () => {
        if (!profile || !selectedBook || selectedChapters.length === 0) return;

        setIsSubmitting(true);
        try {
            const logsToInsert = selectedChapters.map(chapter => ({
                user_id: profile.id,
                book_name: selectedBook.name,
                chapter: chapter
            }));

            const { error: logError } = await db
                .from('reading_logs')
                .insert(logsToInsert)
                .select();

            if (logError) {
                if (logError.code === '23505') { // Unique violation
                    alert('บางบทที่คุณเลือก ได้ถูกบันทึกไปแล้วครับ (ระบบจะบันทึกเฉพาะบทที่ยังไม่เคยมี)');
                    const { error: retryError } = await db
                        .from('reading_logs')
                        .upsert(logsToInsert, { onConflict: 'user_id, book_name, chapter', ignoreDuplicates: true });

                    if (retryError) throw retryError;
                } else {
                    throw logError;
                }
            }

            const { count, error: countError } = await db
                .from('reading_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id);

            if (!countError && count !== null) {
                await db.from('profiles').update({ score: count }).eq('id', profile.id);
            }

            alert(`บันทึกสำเร็จ ${selectedChapters.length} บท! 📖✨`);
            router.push(`/${slug}`);

        } catch (err: unknown) {
            console.error('Error submitting:', err);
            alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">กรุณารอสักครู่...</p>
                    <button onClick={() => router.push(`/${slug}`)} className="text-blue-600 underline">กลับหน้าหลัก</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => selectedBook ? setSelectedBookIndex(null) : router.push(`/${slug}`)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">
                    {selectedBook ? `${selectedBook.name} ` : 'เลือกพระธรรม'}
                </h1>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {!selectedBook ? (
                    <div className="grid grid-cols-1 gap-2">
                        {loadingLogs ? (
                            <div className="text-center text-slate-400 py-8">กำลังโหลดข้อมูล...</div>
                        ) : (
                            bibleBooks.map((book, index) => {
                                const readCount = getReadCountForBook(book.name);
                                const progress = (readCount / book.chapters) * 100;
                                const isComplete = readCount === book.chapters;
                                return (
                                    <button
                                        key={book.name}
                                        onClick={() => handleBookSelect(index)}
                                        className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col gap-2 hover:border-blue-300 active:bg-blue-50 transition-colors text-left ${isComplete ? 'border-green-300 bg-green-50' : 'border-slate-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                {isComplete && <CheckCircle size={18} className="text-green-600" />}
                                                <span className={`font-medium ${isComplete ? 'text-green-700' : 'text-slate-800'}`}>{book.name}</span>
                                            </div>
                                            <div className="flex items-center text-slate-400 text-sm gap-2">
                                                <span className={readCount > 0 ? 'text-green-600' : ''}>
                                                    {readCount}/{book.chapters} บท
                                                </span>
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                        {readCount > 0 && (
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-2 px-1">
                            <div className="flex justify-between items-center">
                                <p className="text-slate-500 text-sm">เลือกบทที่อ่าน</p>
                                <button
                                    onClick={() => { setSelectedChapters([]); setLastClickedChapter(null); }}
                                    className="text-xs text-red-500 underline"
                                    hidden={selectedChapters.length === 0}
                                >
                                    ล้างที่เลือก ({selectedChapters.length})
                                </button>
                            </div>
                            <p className="text-xs text-blue-500">💡 Tip: กดบทแรก แล้วกดบทสุดท้าย เพื่อเลือกทั้ง range</p>
                            {lastClickedChapter && (
                                <p className="text-xs text-orange-500">📍 กดบทต่อไปเพื่อเลือก range จากบท {lastClickedChapter}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                            {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((chapter) => {
                                const isRead = getReadChaptersForBook(selectedBook.name).includes(chapter);
                                const isSelected = selectedChapters.includes(chapter);
                                return (
                                    <button
                                        key={chapter}
                                        onClick={() => !isRead && toggleChapter(chapter)}
                                        disabled={isRead}
                                        className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all shadow-sm relative
                                            ${isRead
                                                ? 'bg-green-100 text-green-600 cursor-default border border-green-200'
                                                : isSelected
                                                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-105'
                                                    : 'bg-white text-slate-700 hover:border-blue-300 border border-slate-100'
                                            }`}
                                    >
                                        {isRead ? (
                                            <CheckCircle size={24} className="text-green-600" />
                                        ) : (
                                            chapter
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div className="max-w-lg mx-auto">
                                <button
                                    onClick={handleSubmit}
                                    disabled={selectedChapters.length === 0 || isSubmitting}
                                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                            ${selectedChapters.length === 0
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-green-600 text-white shadow-lg shadow-green-200 active:scale-95'
                                        } `}
                                >
                                    {isSubmitting ? (
                                        'กำลังบันทึก...'
                                    ) : (
                                        <>
                                            <Check size={24} />
                                            บันทึก {selectedChapters.length} บท
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
