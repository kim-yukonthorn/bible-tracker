'use client';

import { BookOpen } from 'lucide-react';

export default function LoadingScreen() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col items-center justify-center">
            {/* Logo and Title */}
            <div className="text-center mb-8">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <BookOpen className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                    Bible Tracker ✝️
                </h1>
                <p className="text-blue-200 text-lg">
                    ติดตามการอ่านพระคัมภีร์
                </p>
            </div>

            {/* Spinner */}
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-white/20 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="text-white/80 text-sm animate-pulse">
                    กำลังเชื่อมต่อ LINE...
                </p>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-20 left-10 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>
            <div className="absolute bottom-32 right-10 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
            <div className="absolute top-1/3 right-20 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>
        </div>
    );
}
