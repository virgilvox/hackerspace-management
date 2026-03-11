'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, Users2, Send, ChevronLeft } from 'lucide-react'
import type { Tables } from '@/types/database'

type Channel = Tables<'comms_channels'>
type Message = Tables<'comms_messages'>

interface Props {
  member: Tables<'space_members'>
  space: Tables<'spaces'>
  channels: Channel[]
}

export default function CommsClient({ member, space, channels }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(channels[0] || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showChannelList, setShowChannelList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedChannel) return
    loadMessages()

    const supabase = createClient()
    const subscription = supabase
      .channel(`channel:${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comms_messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        payload => {
          setMessages(prev => {
            // Dedup: don't add if we already have a message with this id
            // (e.g. from the optimistic update that was then confirmed)
            if (prev.some(m => m.id === payload.new.id)) return prev
            // Also replace any temp message from same user sent at ~same time
            const hasTempForThisUser = prev.some(
              m =>
                typeof m.id === 'string' &&
                m.id.startsWith('temp-') &&
                m.user_id === payload.new.user_id &&
                m.content === payload.new.content,
            )
            if (hasTempForThisUser) {
              return prev.map(m =>
                typeof m.id === 'string' &&
                m.id.startsWith('temp-') &&
                m.user_id === payload.new.user_id &&
                m.content === payload.new.content
                  ? payload.new
                  : m,
              )
            }
            return [...prev, payload.new]
          })
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
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
    const content = newMessage.trim()
    if (!content || sending) return
    setSending(true)

    // Optimistic insert — message appears immediately for the sender
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      channel_id: selectedChannel.id,
      space_id: space?.id ?? member.space_id,
      user_id: member.user_id,
      display_name: member.display_name,
      handle: member.handle,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setNewMessage('')

    const supabase = createClient()
    const { data, error } = await supabase
      .from('comms_messages')
      .insert({
        channel_id: selectedChannel.id,
        space_id: space?.id ?? member.space_id,
        user_id: member.user_id,
        display_name: member.display_name,
        handle: member.handle,
        content,
      })
      .select()
      .single()

    if (error) {
      // Roll back optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
    } else if (data) {
      // Replace temp with confirmed message (realtime may also fire — dedup handles it)
      setMessages(prev => prev.map(m => (m.id === tempId ? data : m)))
    }

    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e as unknown as React.FormEvent)
    }
  }

  const generalChannels = channels.filter(c => c.channel_type === 'general')
  const areaChannels = channels.filter(c => c.channel_type === 'area')
  const projectChannels = channels.filter(c => c.channel_type === 'project')

  return (
    <div className="h-[calc(100vh-52px)] md:h-screen bg-background flex flex-col">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {/* Mobile back to channels */}
          {!showChannelList && selectedChannel && (
            <button
              onClick={() => setShowChannelList(true)}
              className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground mr-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-white font-sans text-lg font-semibold">
            {!showChannelList && selectedChannel ? `#${selectedChannel.name}` : 'Comms'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sidebar-foreground/70 hover:text-sidebar-foreground text-sm">
            <Users2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Channels sidebar — hidden on mobile when a channel is selected */}
        <aside className={`${showChannelList ? 'flex' : 'hidden'} md:flex w-full md:w-[220px] flex-col bg-card border-r border-border overflow-y-auto`}>
          <div className="p-3">
            {generalChannels.length > 0 && (
              <div className="mb-4">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2 px-2">GENERAL</p>
                {generalChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => { setSelectedChannel(channel); setShowChannelList(false) }}
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
                    onClick={() => { setSelectedChannel(channel); setShowChannelList(false) }}
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
                    onClick={() => { setSelectedChannel(channel); setShowChannelList(false) }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-sans transition ${
                      selectedChannel?.id === channel.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main chat area */}
        {selectedChannel ? (
          <div className={`${showChannelList ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
            {/* Channel header */}
            <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="font-sans text-sm text-muted-foreground">No messages yet. Say hello!</p>
                </div>
              )}
              {messages.map(msg => {
                const isMe = msg.user_id === member.user_id
                const isTemp = typeof msg.id === 'string' && msg.id.startsWith('temp-')
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 ${
                      isMe ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {(msg.display_name || msg.handle || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className={`max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      <div className="flex items-center gap-2">
                        {!isMe && (
                          <span className="font-sans text-xs font-medium text-foreground">
                            {msg.display_name || msg.handle}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isTemp && ' · sending...'}
                        </span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl font-sans text-sm leading-relaxed ${
                        isMe
                          ? `bg-primary text-white rounded-tr-sm ${isTemp ? 'opacity-70' : ''}`
                          : 'bg-card border border-border text-foreground rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-border bg-card">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${selectedChannel.name}`}
                  className="flex-1 bg-background border border-border rounded-full px-4 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-1.5 px-2">
                Press Enter to send
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-sans text-sm text-muted-foreground">Select a channel to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}
