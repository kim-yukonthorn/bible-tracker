'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import liff from '@line/liff'
import { Liff } from '@line/liff'
import { supabase } from '../lib/supabaseClient'

interface Profile {
    id: string
    display_name: string
    avatar_url: string
}

interface LiffContextType {
    profile: Profile | null
    liff: Liff | null
    error: string | null
    isInitializing: boolean
    hasSeenOnboarding: boolean
    completeOnboarding: () => Promise<void>
}

const ONBOARDING_KEY = 'bible-tracker-onboarding-completed'

const LiffContext = createContext<LiffContextType>({
    profile: null,
    liff: null,
    error: null,
    isInitializing: true,
    hasSeenOnboarding: false,
    completeOnboarding: async () => { },
})

export const useLiff = () => useContext(LiffContext)

interface LiffProviderProps {
    children: ReactNode
}

export const LiffProvider = ({ children }: LiffProviderProps) => {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)

    useEffect(() => {
        const initLiff = async () => {
            try {
                // Check localStorage first (fast)
                const localOnboarding = localStorage.getItem(ONBOARDING_KEY)
                if (localOnboarding === 'true') {
                    setHasSeenOnboarding(true)
                }

                const liffId = process.env.NEXT_PUBLIC_LIFF_ID
                if (!liffId) {
                    throw new Error('NEXT_PUBLIC_LIFF_ID is not defined')
                }

                await liff.init({ liffId })

                if (!liff.isLoggedIn()) {
                    liff.login()
                    return // login will redirect, so we stop here
                }

                const liffProfile = await liff.getProfile()
                const userProfile: Profile = {
                    id: liffProfile.userId,
                    display_name: liffProfile.displayName,
                    avatar_url: liffProfile.pictureUrl || '',
                }

                setProfile(userProfile)

                // Upsert profile to Supabase
                const { error: upsertError } = await supabase
                    .from('profiles')
                    .upsert(userProfile, { onConflict: 'id' })

                if (upsertError) {
                    console.error('Error upserting profile:', upsertError)
                }

                // Check Supabase for onboarding status if not in localStorage
                if (!localOnboarding) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('has_seen_onboarding')
                        .eq('id', userProfile.id)
                        .single()

                    if (data?.has_seen_onboarding) {
                        setHasSeenOnboarding(true)
                        localStorage.setItem(ONBOARDING_KEY, 'true')
                    }
                }

            } catch (err: unknown) {
                console.error('LIFF initialization failed', err)
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError('LIFF initialization failed with unknown error')
                }
            } finally {
                setIsInitializing(false)
            }
        }

        initLiff()
    }, [])

    const completeOnboarding = async () => {
        // Save to localStorage (fast)
        localStorage.setItem(ONBOARDING_KEY, 'true')
        setHasSeenOnboarding(true)

        // Save to Supabase (persistent)
        if (profile) {
            await supabase
                .from('profiles')
                .update({ has_seen_onboarding: true })
                .eq('id', profile.id)
        }
    }

    return (
        <LiffContext.Provider value={{ profile, liff, error, isInitializing, hasSeenOnboarding, completeOnboarding }}>
            {children}
        </LiffContext.Provider>
    )
}

