'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useLiff } from '@/components/LiffProvider';
import { bibleBooks } from '@/data/bible';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';

export default function RecordPage() {
    const router = useRouter();
    const { profile } = useLiff();

    const [selectedBookIndex, setSelectedBookIndex] = useState<number | null>(null);
    const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedBook = selectedBookIndex !== null ? bibleBooks[selectedBookIndex] : null;

    const handleBookSelect = (index: number) => {
        setSelectedBookIndex(index);
        setSelectedChapters([]); // Reset chapters when book changes
    };

    const toggleChapter = (chapter: number) => {
        setSelectedChapters(prev =>
            prev.includes(chapter)
                ? prev.filter(c => c !== chapter)
                : [...prev, chapter]
        );
    };

    const handleSubmit = async () => {
        if (!profile || !selectedBook || selectedChapters.length === 0) return;

        setIsSubmitting(true);
        try {
            // 1. Prepare data for batch insert
            const logsToInsert = selectedChapters.map(chapter => ({
                user_id: profile.id,
                book_name: selectedBook.name,
                chapter: chapter
            }));

            // 2. Insert into reading_logs with ignoreDuplicates
            const { error: logError } = await supabase
                .from('reading_logs')
                .insert(logsToInsert)
                .select();

            // Note: We are not using ignoreDuplicates: true explicitly because the default behavior 
            // is to error on conflict. However, for a better UX, if some succeed and some fail, 
            // Supabase basic client might block all.
            // To keep it robust for this MVP, we'll try to insert. If it fails with unique violation, 
            // it usually means AT LEAST ONE failed. 
            // Ideally we would filter beforehand.

            if (logError) {
                if (logError.code === '23505') { // Unique violation
                    alert('บางบทที่คุณเลือก ได้ถูกบันทึกไปแล้วครับ (ระบบจะบันทึกเฉพาะบทที่ยังไม่เคยมี)');
                    // In a real app we might want to retry specifically the ones that don't exist, 
                    // or just use UPSERT (ignore duplicates)? 
                    // Actually upsert would update timestamps which is weird but fine.
                    // Let's rely on user not selecting duplicates for now or fix later.
                    // Re-strategy: use Upsert with ignoreDuplicates behavior? 
                    // Postgres `ON CONFLICT DO NOTHING` is what we want.
                    // Supabase-js `.upsert(..., { onConflict: 'user_id, book_name, chapter', ignoreDuplicates: true })`

                    const { error: retryError } = await supabase
                        .from('reading_logs')
                        .upsert(logsToInsert, { onConflict: 'user_id, book_name, chapter', ignoreDuplicates: true });

                    if (retryError) throw retryError;
                } else {
                    throw logError;
                }
            }

            // 3. Update Score
            // For simplicity, we just count how many we actually inserted? 
            // Without accurate return from ignoreDuplicates insert, it's hard to know exactly how many *new* rows were added.
            // So safest way is to recalculate score or accept minor drift in MVP (or trust user).
            // Let's implement Recalculate Score for 100% accuracy.

            const { count, error: countError } = await supabase
                .from('reading_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id);

            if (!countError && count !== null) {
                await supabase.from('profiles').update({ score: count }).eq('id', profile.id);
            } else {
                // Fallback: Increment by selection count (risky if duplicates were selected but ignored)
                // But since we did "upsert ignore", we can't easily know count. 
                // Re-fetching count is the best way.
            }

            alert(`บันทึกสำเร็จ ${selectedChapters.length} บท! 📖✨`);
            router.push('/'); // Back to leaderboard

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
                    <button onClick={() => router.push('/')} className="text-blue-600 underline">กลับหน้าหลัก</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
                <button onClick={() => selectedBook ? setSelectedBookIndex(null) : router.push('/')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-slate-800">
                    {selectedBook ? `${selectedBook.name} ` : 'เลือกพระธรรม'}
                </h1>
            </div>

            <div className="p-4 max-w-lg mx-auto">
                {!selectedBook ? (
                    // Book Selection
                    <div className="grid grid-cols-1 gap-2">
                        {bibleBooks.map((book, index) => (
                            <button
                                key={book.name}
                                onClick={() => handleBookSelect(index)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:border-blue-300 active:bg-blue-50 transition-colors text-left"
                            >
                                <span className="font-medium text-slate-800">{book.name}</span>
                                <div className="flex items-center text-slate-400 text-sm gap-2">
                                    <span>{book.chapters} บท</span>
                                    <ChevronRight size={16} />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    // Chapter Selection
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-1">
                            <p className="text-slate-500 text-sm">เลือกบทที่อ่าน (เลือกได้หลายข้อ)</p>
                            <button
                                onClick={() => setSelectedChapters([])}
                                className="text-xs text-red-500 underline"
                                hidden={selectedChapters.length === 0}
                            >
                                ล้างที่เลือก ({selectedChapters.length})
                            </button>
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                            {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((chapter) => (
                                <button
                                    key={chapter}
                                    onClick={() => toggleChapter(chapter)}
                                    className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold transition-all shadow-sm
                            ${selectedChapters.includes(chapter)
                                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-105'
                                            : 'bg-white text-slate-700 hover:border-blue-300 border border-slate-100'
                                        } `}
                                >
                                    {chapter}
                                </button>
                            ))}
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