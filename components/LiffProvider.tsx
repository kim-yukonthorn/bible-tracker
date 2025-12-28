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
}

const LiffContext = createContext<LiffContextType>({
    profile: null,
    liff: null,
    error: null,
})

export const useLiff = () => useContext(LiffContext)

interface LiffProviderProps {
    children: ReactNode
}

export const LiffProvider = ({ children }: LiffProviderProps) => {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const initLiff = async () => {
            try {
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
                    // We don't necessarily want to block the UI if upsert fails, but good to know
                }

            } catch (err: unknown) {
                console.error('LIFF initialization failed', err)
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError('LIFF initialization failed with unknown error')
                }
            }
        }

        initLiff()
    }, [])

    return (
        <LiffContext.Provider value={{ profile, liff, error }}>
            {children}
        </LiffContext.Provider>
    )
}
