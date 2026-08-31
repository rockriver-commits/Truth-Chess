import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Public comments/feedback page. Submissions are emailed to the owner via the
// submit-feedback backend function; the owner's address never appears here.
export default function Feedback() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!message.trim()) {
      setError('Please enter a comment.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await base44.functions.invoke('submit-feedback', { name, email, message });
      if (res?.data?.ok) {
        setDone(true);
      } else {
        setError(res?.data?.error || 'Could not send your comment. Please try again.');
      }
    } catch (err) {
      setError('Could not send your comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-amber-50/40">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <Link to="/" className="text-sm text-amber-600 hover:underline">
          ← Back to game
        </Link>

        <h1 className="mt-4 text-3xl font-display font-semibold tracking-tight text-stone-800">
          Comments &amp; Feedback
        </h1>
        <p className="mt-2 text-stone-500">
          Tell me what you think of Truth Chess — bug reports, ideas, or just a note. Your
          comment is sent directly to the developer.
        </p>

        {done ? (
          <div className="mt-8 rounded-2xl bg-white/80 ring-1 ring-stone-200 p-6 text-center">
            <p className="text-lg font-semibold text-stone-800">Thanks for your comment!</p>
            <p className="mt-1 text-sm text-stone-500">I'll read it as soon as I can.</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-800 text-white text-sm font-medium px-4 py-2 hover:bg-stone-900 transition"
            >
              Back to game →
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 space-y-4 rounded-2xl bg-white/80 ring-1 ring-stone-200 p-6"
          >
            <div>
              <Label htmlFor="name">Your name (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Anonymous"
              />
            </div>
            <div>
              <Label htmlFor="email">Your email (optional, if you'd like a reply)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="message">Your comment</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={5000}
                rows={6}
                placeholder="Share your thoughts about Truth Chess…"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Sending…' : 'Send comment'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}