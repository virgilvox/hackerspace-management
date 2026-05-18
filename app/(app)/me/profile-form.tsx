'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateMyProfile, discloseAffiliations } from '@/lib/actions'

export type ProfileInitial = {
  display_name: string
  handle: string
  phone: string
  bio: string
  skills: string[]
  interests: string[]
  willing_to: string[]
  affiliations: string[]
}

const toList = (s: string): string[] =>
  s.split(',').map(x => x.trim()).filter(Boolean)
const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [handle, setHandle] = useState(initial.handle)
  const [phone, setPhone] = useState(initial.phone)
  const [bio, setBio] = useState(initial.bio)
  const [skills, setSkills] = useState(initial.skills.join(', '))
  const [interests, setInterests] = useState(initial.interests.join(', '))
  const [willingTo, setWillingTo] = useState(initial.willing_to.join(', '))
  const [affiliations, setAffiliations] = useState(initial.affiliations.join(', '))

  async function save() {
    if (!displayName.trim()) return toast.error('Display name is required.')
    setBusy(true)

    const res = await updateMyProfile({
      display_name: displayName.trim(),
      handle: handle.trim() || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      skills: toList(skills),
      interests: toList(interests),
      willing_to: toList(willingTo),
    })
    if ('error' in res && res.error) {
      setBusy(false)
      return toast.error(res.error)
    }

    // Only re-disclose affiliations when they actually changed, so the
    // conflict-of-interest disclosure timestamp is not reset on every save.
    const nextAffiliations = toList(affiliations)
    if (!sameList(nextAffiliations, initial.affiliations)) {
      const aff = await discloseAffiliations({ affiliations: nextAffiliations })
      if ('error' in aff && aff.error) {
        setBusy(false)
        return toast.error(aff.error)
      }
    }

    setBusy(false)
    toast.success('Profile saved.')
    router.refresh()
  }

  return (
    <div className="bg-card rounded border border-border p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-name">Display name</Label>
          <Input id="pf-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-handle">Handle</Label>
          <Input id="pf-handle" value={handle} onChange={e => setHandle(e.target.value)} maxLength={50} placeholder="optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone">Phone</Label>
          <Input id="pf-phone" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="optional" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-bio">Bio</Label>
        <Textarea id="pf-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={2000} rows={3} placeholder="optional" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-skills">Skills</Label>
          <Input id="pf-skills" value={skills} onChange={e => setSkills(e.target.value)} placeholder="comma, separated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-interests">Interests</Label>
          <Input id="pf-interests" value={interests} onChange={e => setInterests(e.target.value)} placeholder="comma, separated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-willing">Willing to</Label>
          <Input id="pf-willing" value={willingTo} onChange={e => setWillingTo(e.target.value)} placeholder="comma, separated" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-aff">Affiliations (conflict-of-interest)</Label>
          <Input id="pf-aff" value={affiliations} onChange={e => setAffiliations(e.target.value)} placeholder="comma, separated" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  )
}
