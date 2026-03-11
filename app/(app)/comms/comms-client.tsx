'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, Users2 } from 'lucide-react'

interface Props {
  member: any
  space: any
  channels: any[]
}

export default function CommsClient({ member, space, channels }: Props) {
  const [selectedChannel, setSelectedChannel] = useState(channels[0] || null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedChannel) return
    loadMessages()
    
    const supabase = createClient()
    const subscription = supabase
      .channel(`channel:${selectedChannel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comms_messages', filter: `channel_id=eq.${selectedChannel.id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
        }
      })
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [selectedChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const supabase = createClient()
    const { data } = await supabase
      .from('comms_messages')
      .select('*')
      .eq('channel_id', selectedChannel.id)
      .order('created_at')
      .limit(100)
    setMessages(data ?? [])
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('comms_messages').insert({
      channel_id: selectedChannel.id,
      space_id: space?.id ?? member.space_id,
      user_id: member.user_id,
      display_name: member.display_name,
      handle: member.handle,
      content: newMessage.trim(),
    })
    setNewMessage('')
    setSending(false)
  }

  const generalChannels = channels.filter(c => c.channel_type === 'general')
  const areaChannels = channels.filter(c => c.channel_type === 'area')
  const projectChannels = channels.filter(c => c.channel_type === 'project')

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="bg-sidebar px-6 py-3 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-sans text-lg font-semibold">Comms</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground text-sm">
            <Users2 className="w-4 h-4" />
          </button>
          <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Channels sidebar */}
        <aside className="w-[220px] bg-card border-r border-border overflow-y-auto">
          <div className="p-3">
            {generalChannels.length > 0 && (
              <div className="mb-4">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 px-2">GENERAL</p>
                {generalChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-sans transition ${
                      selectedChannel?.id === channel.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                    {channel.unread_count > 0 && (
                      <span className="ml-auto w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {channel.unread_count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {areaChannels.length > 0 && (
              <div className="mb-4">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 px-2">AREAS</p>
                {areaChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-sans transition ${
                      selectedChannel?.id === channel.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            )}

            {projectChannels.length > 0 && (
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 px-2">PROJECTS</p>
                {projectChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-sans transition ${
                      selectedChannel?.id === channel.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Messages area */}
        {selectedChannel ? (
          <div className="flex-1 flex flex-col">
            {/* Channel header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              <div>
                <p className="font-sans text-sm font-medium text-foreground">{selectedChannel.name}</p>
                {selectedChannel.description && (
                  <p className="font-sans text-xs text-muted-foreground">{selectedChannel.description}</p>
                )}
              </div>
              {selectedChannel.member_count && (
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {selectedChannel.member_count} members
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => {
                const showAvatar = i === 0 || messages[i - 1]?.user_id !== msg.user_id
                return (
                    <div key={msg.id} className={`flex items-start gap-3 ${showAvatar ? '' : 'pl-[52px]'}`}>
                    {showAvatar && (
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-[10px] font-mono font-bold text-primary flex-shrink-0">
                        {(msg.display_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {showAvatar && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-sans text-sm font-medium text-foreground">{msg.display_name || 'Unknown'}</span>
                          {msg.handle && <span className="font-mono text-[10px] text-muted-foreground">@{msg.handle}</span>}
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <p className="font-sans text-sm text-foreground leading-relaxed break-words">
                        {(msg.content || '').split(/(@\w+|#\w+)/g).map((part: string, j: number) => {
                          if (part.startsWith('@')) return <span key={j} className="text-primary font-medium">{part}</span>
                          if (part.startsWith('#')) return <span key={j} className="text-blue-600 font-medium">{part}</span>
                          return part
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Message #${selectedChannel.name}`}
                  className="flex-1 bg-muted border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-primary text-white px-4 py-2 rounded font-sans text-sm hover:bg-primary/90 transition disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p className="font-sans text-sm">Select a channel to view messages</p>
          </div>
        )}
      </div>
    </div>
  )
}
