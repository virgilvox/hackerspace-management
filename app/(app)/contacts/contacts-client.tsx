'use client'

import { useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import { createContact, updateContact, deleteContact } from '@/lib/actions'

interface Contact {
  id: string
  name: string
  contact_type: string
  email?: string
  phone?: string
  details?: string
  note?: string
  group_label?: string
  tags?: string[]
  code?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  vendor: 'text-primary border-primary/30 bg-primary/5',
  supplier: 'text-muted-foreground border-border bg-muted',
  landlord: 'text-orange-600 border-orange-300 bg-orange-50',
  city: 'text-red-600 border-red-300 bg-red-50',
  partner: 'text-blue-600 border-blue-300 bg-blue-50',
}

const GROUPS: Record<string, string[]> = {
  'Vendors & Suppliers': ['vendor', 'supplier'],
  'Landlord & City': ['landlord', 'city'],
  'Community & Partners': ['partner'],
}

export function ContactsClient({ contacts: initialContacts }: { contacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [form, setForm] = useState({
    name: '', contact_type: 'vendor', email: '', phone: '', details: '', group_label: '', tags: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = search
    ? contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
    : contacts

  // Group by type
  const grouped: Record<string, Contact[]> = {}
  for (const [groupName, types] of Object.entries(GROUPS)) {
    const items = filtered.filter(c => types.includes(c.contact_type))
    if (items.length > 0) grouped[groupName] = items
  }
  // Catch any ungrouped
  const knownTypes = Object.values(GROUPS).flat()
  const other = filtered.filter(c => !knownTypes.includes(c.contact_type))
  if (other.length > 0) grouped['Other'] = other

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await createContact({
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    if (result.data) setContacts(prev => [...prev, result.data as Contact])
    setShowCreate(false)
    resetForm()
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editContact) return
    setLoading(true)
    setError('')
    const result = await updateContact(editContact.id, {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    setContacts(prev => prev.map(c => c.id === editContact.id ? { ...c, ...form } : c))
    setEditContact(null)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return
    const result = await deleteContact(id)
    if (!result.error) setContacts(prev => prev.filter(c => c.id !== id))
  }

  function openEdit(c: Contact) {
    setEditContact(c)
    setForm({
      name: c.name, contact_type: c.contact_type, email: c.email ?? '',
      phone: c.phone ?? '', details: c.details ?? '', group_label: c.group_label ?? '',
      tags: c.tags?.join(', ') ?? '',
    })
    setError('')
  }

  function resetForm() {
    setForm({ name: '', contact_type: 'vendor', email: '', phone: '', details: '', group_label: '', tags: '' })
    setError('')
  }

  const ContactForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void, submitLabel: string }) => (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Name *</label>
          <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Type</label>
          <select value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
            {Object.keys(CATEGORY_COLORS).map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Details / Notes</label>
        <textarea value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
          rows={2} className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition resize-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Group Label</label>
          <input type="text" value={form.group_label} onChange={e => setForm(f => ({ ...f, group_label: e.target.value }))}
            placeholder="e.g. Equipment Vendors"
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Tags</label>
          <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="laser, cnc, maintenance"
            className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      {error && <p className="font-mono text-xs text-red-500">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => { setShowCreate(false); setEditContact(null); resetForm() }}
          className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
        <button type="submit" disabled={loading}
          className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <h1 className="text-white font-sans text-lg font-semibold">Contacts</h1>
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded pl-9 pr-4 py-2.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
          />
        </div>

        {Object.keys(grouped).length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
                  {group.toUpperCase()}
                </p>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {items.map(contact => {
                    const initials = contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 3)
                    return (
                      <div key={contact.id} className="flex items-center gap-3 px-4 py-3 group">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-sm font-medium text-foreground">{contact.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {[contact.email, contact.phone, contact.details].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded border flex-shrink-0 ${
                          CATEGORY_COLORS[contact.contact_type] ?? 'text-muted-foreground border-border bg-muted'
                        }`}>
                          {contact.contact_type?.toUpperCase()}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => openEdit(contact)}
                            className="text-muted-foreground hover:text-primary transition"
                            aria-label="Edit contact"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="text-muted-foreground hover:text-destructive transition"
                            aria-label="Delete contact"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded border border-dashed border-border p-16 text-center">
            <p className="font-sans text-sm text-muted-foreground">No contacts yet</p>
            <button onClick={() => setShowCreate(true)} className="font-mono text-xs text-primary mt-2 block mx-auto hover:underline">
              + Add first contact
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">Add Contact</h2>
              <button onClick={() => { setShowCreate(false); resetForm() }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <ContactForm onSubmit={handleCreate} submitLabel="Add Contact" />
          </div>
        </div>
      )}

      {editContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">Edit {editContact.name}</h2>
              <button onClick={() => { setEditContact(null); resetForm() }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <ContactForm onSubmit={handleEdit} submitLabel="Save Changes" />
          </div>
        </div>
      )}
    </div>
  )
}
