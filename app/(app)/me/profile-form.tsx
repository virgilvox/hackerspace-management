'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChipInput } from '@/components/chip-input'
import { WILLING_TO_SUGGESTIONS } from '@/lib/profile-presets'
import { updateMyProfile, discloseAffiliations, requestEmailChange } from '@/lib/actions'

export type ProfileInitial = {
  email: string
  display_name: string
  handle: string
  phone: string
  bio: string
  skills: string[]
  interests: string[]
  willing_to: string[]
  affiliations: string[]
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

const fieldLabel = 'font-mono text-[10px] tracking-widest text-muted-foreground uppercase'

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [handle, setHandle] = useState(initial.handle)
  const [phone, setPhone] = useState(initial.phone)
  const [bio, setBio] = useState(initial.bio)
  const [skills, setSkills] = useState<string[]>(initial.skills)
  const [interests, setInterests] = useState<string[]>(initial.interests)
  const [willingTo, setWillingTo] = useState<string[]>(initial.willing_to)
  const [affiliations, setAffiliations] = useState<string[]>(initial.affiliations)

  async function save() {
    if (!displayName.trim()) return toast.error('Display name is required.')
    setBusy(true)

    const res = await updateMyProfile({
      display_name: displayName.trim(),
      handle: handle.trim() || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      skills,
      interests,
      willing_to: willingTo,
    })
    if ('error' in res && res.error) {
      setBusy(false)
      return toast.error(res.error)
    }

    // Only re-disclose affiliations when they actually changed, so the
    // conflict-of-interest disclosure timestamp is not reset on every save.
    if (!sameList(affiliations, initial.affiliations)) {
      const aff = await discloseAffiliations({ affiliations })
      if ('error' in aff && aff.error) {
        setBusy(false)
        return toast.error(aff.error)
      }
    }

    setBusy(false)
    toast.success('Profile saved.')
    router.refresh()
  }

  async function changeEmail() {
    const e = newEmail.trim()
    if (!e) return toast.error('Enter the new email address.')
    setEmailBusy(true)
    const res = await requestEmailChange({ email: e })
    setEmailBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setNewEmail('')
    toast.success(
      'Confirmation sent. Check BOTH your current and new email to finish the change.',
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-5 space-y-5">
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

        <div className="space-y-1.5">
          <span className={fieldLabel}>Skills</span>
          <ChipInput values={skills} onChange={setSkills} placeholder="add a skill and press enter" maxLength={60} maxItems={40} />
        </div>

        <div className="space-y-1.5">
          <span className={fieldLabel}>Interests</span>
          <ChipInput values={interests} onChange={setInterests} placeholder="add an interest and press enter" maxLength={60} maxItems={40} />
        </div>

        <div className="space-y-1.5">
          <span className={fieldLabel}>Willing to do</span>
          <ChipInput
            values={willingTo}
            onChange={setWillingTo}
            placeholder="add a role and press enter"
            maxLength={60}
            maxItems={20}
            suggestions={WILLING_TO_SUGGESTIONS}
          />
          <p className="font-sans text-xs text-muted-foreground">
            Used by the board-only recruitment view when looking for members willing to take on a role.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className={fieldLabel}>Affiliations (conflict-of-interest)</span>
          <ChipInput values={affiliations} onChange={setAffiliations} placeholder="add an affiliation and press enter" maxLength={200} maxItems={50} />
        </div>

        <div className="flex justify-end">
          <Button size="sm" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <div>
          <p className="font-sans text-sm font-medium text-foreground">Login email</p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {initial.email || 'not set'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-email">New email</Label>
            <Input
              id="pf-email"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              maxLength={254}
              placeholder="new@email.com"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-sans text-xs text-muted-foreground">
            You must confirm via links sent to both your current and new address.
          </p>
          <Button size="sm" variant="outline" disabled={emailBusy} onClick={changeEmail}>
            {emailBusy ? 'Sending…' : 'Change email'}
          </Button>
        </div>
      </div>
    </div>
  )
}
