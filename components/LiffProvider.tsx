'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import liff from '@line/liff'
import { Liff } from '@line/liff'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase, createAuthedClient } from '../lib/supabaseClient'

interface Profile {
    id: string
    display_name: string
    avatar_url: string
}

export interface Church {
    id: string
    name: string
    slug: string
    join_code: string
}

export interface Membership {
    church_id: string
    role: 'admin' | 'member'
    church: Church
}

interface LiffContextType {
    profile: Profile | null
    db: SupabaseClient            // authed client (falls back to anon before login)
    liff: Liff | null
    error: string | null
    isInitializing: boolean
    hasSeenOnboarding: boolean
    completeOnboarding: () => Promise<void>
    memberships: Membership[]
    refreshMemberships: () => Promise<void>
    roleForChurch: (churchId: string) => 'admin' | 'member' | null
}

const ONBOARDING_KEY = 'bible-tracker-onboarding-completed'

const LiffContext = createContext<LiffContextType>({
    profile: null,
    db: supabase,
    liff: null,
    error: null,
    isInitializing: true,
    hasSeenOnboarding: false,
    completeOnboarding: async () => { },
    memberships: [],
    refreshMemberships: async () => { },
    roleForChurch: () => null,
})

export const useLiff = () => useContext(LiffContext)

interface LiffProviderProps {
    children: ReactNode
}

export const LiffProvider = ({ children }: LiffProviderProps) => {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [db, setDb] = useState<SupabaseClient>(supabase)
    const [memberships, setMemberships] = useState<Membership[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)

    const loadMemberships = useCallback(async (client: SupabaseClient, userId: string) => {
        const { data, error: membersError } = await client
            .from('church_members')
            .select('church_id, role, church:churches(id, name, slug, join_code)')
            .eq('user_id', userId)

        if (membersError) {
            console.error('Error loading memberships:', membersError)
            return
        }
        setMemberships((data ?? []) as unknown as Membership[])
    }, [])

    useEffect(() => {
        const initLiff = async () => {
            try {
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

                // Bridge LINE identity -> Supabase JWT so RLS can identify the user.
                const idToken = liff.getIDToken()
                let client = supabase
                if (idToken) {
                    const res = await fetch('/api/auth/line', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken }),
                    })
                    if (res.ok) {
                        const { token } = await res.json()
                        client = createAuthedClient(token)
                    } else {
                        console.error('Auth bridge failed:', await res.text())
                    }
                }
                setDb(client)

                // Upsert profile (RLS allows writing your own row).
                const { error: upsertError } = await client
                    .from('profiles')
                    .upsert(userProfile, { onConflict: 'id' })
                if (upsertError) {
                    console.error('Error upserting profile:', upsertError)
                }

                await loadMemberships(client, userProfile.id)

                if (!localOnboarding) {
                    const { data } = await client
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
                setError(err instanceof Error ? err.message : 'LIFF initialization failed with unknown error')
            } finally {
                setIsInitializing(false)
            }
        }

        initLiff()
    }, [loadMemberships])

    const refreshMemberships = useCallback(async () => {
        if (profile) {
            await loadMemberships(db, profile.id)
        }
    }, [db, profile, loadMemberships])

    const roleForChurch = useCallback(
        (churchId: string) => memberships.find(m => m.church_id === churchId)?.role ?? null,
        [memberships],
    )

    const completeOnboarding = async () => {
        localStorage.setItem(ONBOARDING_KEY, 'true')
        setHasSeenOnboarding(true)
        if (profile) {
            await db.from('profiles').update({ has_seen_onboarding: true }).eq('id', profile.id)
        }
    }

    return (
        <LiffContext.Provider
            value={{
                profile,
                db,
                liff,
                error,
                isInitializing,
                hasSeenOnboarding,
                completeOnboarding,
                memberships,
                refreshMemberships,
                roleForChurch,
            }}
        >
            {children}
        </LiffContext.Provider>
    )
}
