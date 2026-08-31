import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Public feedback form handler. Players submit a comment about the game; it is
// emailed to the owner (FEEDBACK_TO_EMAIL) without ever exposing that address
// to the player. No user auth required — guests can comment too.
export default async function(req) {
  try {
    const toEmail = secrets.get("FEEDBACK_TO_EMAIL");
    if (!toEmail) {
      return Response.json(
        { error: "Feedback is not configured yet. Please try again later." },
        { status: 503 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 5000) {
      return Response.json(
        { error: "Please enter a comment (up to 5000 characters)." },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const subject = "Truth Chess — new comment" + (name ? ` from ${name}` : "");
    const emailBody =
      "You received a new comment on Truth Chess.\n\n" +
      (name ? `Name: ${name}\n` : "") +
      (email ? `Reply email: ${email}\n` : "") +
      "\nMessage:\n" + message + "\n";

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: toEmail,
      subject,
      body: emailBody,
      from_name: "Truth Chess Feedback",
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}