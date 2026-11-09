// The writing rules the pipeline enforces. Evidence and sources: docs/hook-research.md.

export const WORDS_PER_MINUTE = 150;

export const VOICE_RULES = `
Write for the ear. This will be read aloud to a phone camera.
- Short spoken sentences. Contractions. Words a smart 12-year-old knows.
- One thought per sentence. If it needs a comma to survive, split it.
- No em dashes, semicolons, hashtags, emojis or stage directions in spoken lines.
- Never use: "game changer", "unlock", "dive in", "let's talk about", "here's the thing", "the truth is", "in today's world".
- Never use the construction "it's not X, it's Y" or "not just X but Y".
- No triplets of parallel phrases. No closing moral that restates the video.`;

export const TRUTH_RULES = `
Be useful and be honest.
- The video must teach, reveal or argue something real about the topic. Use your own solid knowledge of the subject for substance: mechanisms, practical steps, typical costs, concrete examples.
- Never make up a study, statistic, quote, person or event. If a fact is precise, it must be something you are confident is true and widely documented, and you must list it in factsToCheck so the creator can verify it.
- Scraped posts tell you what people care about right now. They are not proof. A claim that only a post makes must be worded as something people are saying.
- Never talk about the videos, posts, creators, views or trends themselves, unless the topic is social media. The viewer should hear about the topic, never about the research behind the script.
- Never invent a personal story, result, client, or "I tried this" experience. First-person experience is allowed only if it appears in the creator's notes or message. Otherwise write in second person or as a plain statement.
- Never quote or lightly reword a scraped opening. Learn the pattern, write a new line.`;

export const HOOK_PLAYBOOK = `
A hook must earn the next three seconds from a stranger who has no idea who this creator is.

THE CORE RULE: BOUNDED CURIOSITY.
Name the concrete subject and the stakes. Withhold the answer.
- Too vague loses: "This changes everything about your sleep."
- Too complete loses: "Taking magnesium at night improves your sleep."
- In the zone: "Your magnesium is probably the wrong kind for sleep."
The viewer must know exactly what the video is about and be unable to guess the answer.

THE STANDARD. These are for other topics, to show the level. Do not reuse them.
- "Your 8 a.m. coffee is why you crash at 3."
- "Egg whites or a protein scoop. One of them is a rip-off."
- "Your landlord is hoping you never read page six."
- "The free intro session is where your gym starts selling you."
Notice: one plain sentence, about the viewer's own life, said the way a friend would say it.

REQUIREMENTS
1. A stranger understands it instantly. No jargon, insider references or unexplained names.
2. It opens one question that only the end of the video closes. Never answer it in the hook.
3. It carries a high-arousal feeling: surprise, amusement, awe, indignation or worry. Mild interest is a fail.
4. It is specific to this topic. If you can swap in another topic and it still works, rewrite it.
5. The rest of the video can truly pay it off using the available evidence. No bait.
6. It is sayable in one breath in about 3 seconds. Aim for 6 to 12 words in a single sentence, unless the niche norm supplied says otherwise.
7. It is about the viewer's world. Never about other videos, content or what the internet is saying, unless the topic is social media.

THREE LAYERS, ALL WRITTEN TOGETHER
- spoken: the first line out of the creator's mouth.
- onScreenText: 2 to 6 plain words for sound-off viewers. Adds tension to the spoken line, does not repeat it word for word. Must read naturally on its own.
- firstFrame: what the viewer sees in frame one, already in motion. No intro shot. Something a solo creator can film today.
- payoffPromise: the one specific thing the ending delivers.

ARCHETYPES. Use a different one for each candidate.
- belief_flip: a common belief in this niche is wrong or backfiring.
- costly_mistake: the viewer is probably doing a specific thing that costs them.
- mid_action: starts in the middle of a moment, context comes after.
- insider_mechanism: how something actually works behind the scenes.
- comparison: two named things, one surprising winner, winner withheld.
- identity_callout: names exactly who this is for, and what they keep getting wrong.
- fresh_change: something changed recently. Only when the evidence shows it.
- specific_question: a question the viewer thinks they can answer and cannot.

BANNED OPENERS
Greetings, self-introductions, "in this video", "today I'm going to", "did you know", "stop scrolling", "you won't believe", "wait for it", "nobody is talking about this", "here are 3 tips". Numbered listicles are allowed only when the number makes a promise sharper.`;

export const BODY_PLAYBOOK = `
THE BODY HAS ONE JOB: KEEP THE HOOK'S QUESTION ALIVE WHILE PAYING OUT SMALL REWARDS.
- First beat (kind "proof", within about 5 seconds): justify the hook. Show why this is real. Do not restate the hook. No context dump.
- One idea per video. Every line serves the hook's promise. Cut everything else.
- Be concrete. Each beat must contain something the viewer did not already know: a mechanism, a specific step, a real-world example or a practical comparison. "It depends" and "do your research" are failures.
- A new piece of information every 5 to 8 seconds. Each beat is a micro-payoff that raises the next question.
- Link beats with causation, not lists. Prefer "but", "so", "which means", "except" over "also", "next", "and another thing".
- Include one "turn" beat: the moment the obvious answer turns out to be incomplete. This re-hooks viewers who are about to leave.
- Save the strongest point for last. The final answer lands in the "payoff" beat, not before it.
- Give each beat a short "direction": a shot change, on-screen proof, or visual a solo creator can actually do.`;

export const ENDING_PLAYBOOK = `
END FAST AND END HIGH. People remember the peak and the end.
- The "payoff" beat fully answers the hook with a clear, specific verdict or action the viewer can use today. A viewer must never feel baited.
- The "ending" beat is one or two short sentences right after the payoff. No recap, no thanks, no "that's it for today".
- Exactly one action, chosen for this video. Never "like, comment and subscribe" and never "follow for more".
- Prefer an ending that makes someone want to send this to a specific person, since sends drive reach to non-followers: name who to send it to and why. Use only if it is natural.
- Other options: a comment prompt with a real opinion split, a save prompt when the video is a reference, or a loop.
- Loop: when natural, write the last sentence so it flows back into the first line of the hook.`;

export function wordBudget(durationSec: number) {
  const target = Math.round((durationSec / 60) * WORDS_PER_MINUTE);
  return { target, min: Math.round(target * 0.85), max: Math.round(target * 1.1) };
}
