'use client';

import { useEffect, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface OnboardingProps {
    onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
    const startTour = useCallback(() => {
        const driverObj = driver({
            showProgress: true,
            showButtons: ['next', 'previous'],
            nextBtnText: 'ถัดไป',
            prevBtnText: 'ก่อนหน้า',
            doneBtnText: 'เริ่มต้นใช้งาน!',
            progressText: '{{current}} / {{total}}',
            popoverClass: 'bible-tracker-tour',
            steps: [
                {
                    element: '#app-title',
                    popover: {
                        title: 'ยินดีต้อนรับ! 👋',
                        description: 'Bible Tracker ช่วยติดตามการอ่านพระคัมภีร์ของคุณ และสร้างนิสัยการอ่านทุกวัน',
                        side: 'bottom',
                        align: 'center',
                    },
                },
                {
                    element: '#fab-record',
                    popover: {
                        title: 'บันทึกการอ่าน 📖',
                        description: 'กดปุ่มนี้เพื่อบันทึกบทที่คุณอ่าน และรับคะแนนสะสม!',
                        side: 'top',
                        align: 'center',
                    },
                },
                {
                    element: '#history-button',
                    popover: {
                        title: 'ดูประวัติ 📅',
                        description: 'กดที่นี่เพื่อดูปฏิทินการอ่าน 🟢 วันที่อ่าน 🔴 วันที่ไม่ได้อ่าน',
                        side: 'bottom',
                        align: 'start',
                    },
                },
                {
                    element: '#leaderboard',
                    popover: {
                        title: 'กระดานผู้นำ 🏆',
                        description: 'แข่งขันกับเพื่อนๆ ดูว่าใครอ่านได้มากที่สุด!',
                        side: 'top',
                        align: 'center',
                    },
                },
            ],
            onDestroyed: () => {
                onComplete();
            },
        });

        // Start tour immediately
        driverObj.drive();
    }, [onComplete]);

    useEffect(() => {
        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            startTour();
        }, 500);

        return () => clearTimeout(timer);
    }, [startTour]);

    // This component doesn't render anything visible
    // Driver.js handles the overlay
    return null;
}
