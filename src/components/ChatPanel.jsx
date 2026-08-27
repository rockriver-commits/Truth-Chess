import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

// In-game chat for an online game. Messages are stored on the ChatMessage
// entity keyed by game code and kept in sync via the realtime subscription.
export default function ChatPanel({ gameCode, userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!gameCode) return undefined;
    let active = true;
    base44.entities.ChatMessage.filter({ game_code: gameCode }, 'created_date', 200).then(
      (list) => {
        if (active) setMessages(list || []);
      }
    );
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (!event?.data || event.data.game_code !== gameCode) return;
      if (event.type === 'create') {
        setMessages((m) => (m.some((x) => x.id === event.data.id) ? m : [...m, event.data]));
      } else if (event.type === 'delete') {
        setMessages((m) => m.filter((x) => x.id !== event.data.id));
      }
    });
    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, [gameCode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const t = text.trim();
    if (!t || sending || !userId) return;
    setSending(true);
    setText('');
    try {
      const msg = await base44.entities.ChatMessage.create({
        game_code: gameCode,
        user_id: userId,
        text: t,
      });
      setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
    } catch {
      setText(t);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white/80 ring-1 ring-stone-200 shadow-sm p-4">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-2">Chat</p>
      <div className="h-40 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-6">No messages yet</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm ${
                    mine
                      ? 'bg-stone-800 text-white rounded-br-sm'
                      : 'bg-stone-100 text-stone-700 rounded-bl-sm'
                  }`}
                >
                  <p className="break-words">{m.text}</p>
                  <p className={`text-[0.6rem] mt-0.5 ${mine ? 'text-stone-300' : 'text-stone-400'}`}>
                    {mine ? 'You' : 'Opponent'}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Message…"
          maxLength={200}
          className="text-sm"
        />
        <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}