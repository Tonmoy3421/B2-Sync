export type Quote = {
  category: string;
  text: string;
};

export const QUOTES: Quote[] = [
  // Education & Lifelong Learning
  { category: "Education & Lifelong Learning", text: `Curiosity is the spark; education is the oxygen that turns it into a flame.` },
  { category: "Education & Lifelong Learning", text: `True learning begins the moment you realize how much you still have to discover.` },
  { category: "Education & Lifelong Learning", text: `A classroom gives you the map, but self-discipline teaches you how to navigate the terrain.` },
  { category: "Education & Lifelong Learning", text: `Knowledge is the only wealth that multiplies every time you give it away.` },
  { category: "Education & Lifelong Learning", text: `An open mind is the most powerful textbook you will ever carry.` },
  { category: "Education & Lifelong Learning", text: `Study not merely to pass an exam, but to build a mind capable of solving problems that do not exist yet.` },
  { category: "Education & Lifelong Learning", text: `Mistakes are the tuition we pay for mastery.` },
  { category: "Education & Lifelong Learning", text: `Wisdom is simply knowledge tested by time and tempered by humility.` },
  { category: "Education & Lifelong Learning", text: `Reading gives you access to the greatest minds in history without needing an appointment.` },
  { category: "Education & Lifelong Learning", text: `To teach is to learn twice; to question is to learn forever.` },

  // Hard Work & Grit
  { category: "Hard Work & Grit", text: `Talent opens the door, but calloused hands and late nights keep it from slamming shut.` },
  { category: "Hard Work & Grit", text: `Sweat is the down payment on every dream worth owning.` },
  { category: "Hard Work & Grit", text: `Luck has a strange habit of showing up right after eighty hours of preparation.` },
  { category: "Hard Work & Grit", text: `Comfort is the quiet enemy of potential.` },
  { category: "Hard Work & Grit", text: `Do the work nobody sees so you can achieve the results everyone notices.` },
  { category: "Hard Work & Grit", text: `You cannot wish for a harvest if you skipped the season of plowing.` },
  { category: "Hard Work & Grit", text: `Hard work does not guarantee success, but avoiding it guarantees regret.` },
  { category: "Hard Work & Grit", text: `Excellence is rarely a single dramatic leap; it is thousands of unglamorous repetitions.` },
  { category: "Hard Work & Grit", text: `When energy fades, let habits carry the weight.` },
  { category: "Hard Work & Grit", text: `The mountain does not care how tired you are; it only yields to the next step.` },

  // Motivation & Drive
  { category: "Motivation & Drive", text: `Stop waiting for the mood to strike—action creates momentum, and momentum creates motivation.` },
  { category: "Motivation & Drive", text: `Your future self is watching your habits today; give them something to be proud of.` },
  { category: "Motivation & Drive", text: `Small daily progress beats sporadic bursts of perfection every single time.` },
  { category: "Motivation & Drive", text: `Fear shrinks the exact moment you take your first step forward.` },
  { category: "Motivation & Drive", text: `Do not measure your journey against someone else’s highlight reel.` },
  { category: "Motivation & Drive", text: `Hunger for growth is louder than any excuse.` },
  { category: "Motivation & Drive", text: `Every expert was once a beginner who refused to quit on a bad day.` },
  { category: "Motivation & Drive", text: `Focus on the next five minutes rather than the next five years.` },
  { category: "Motivation & Drive", text: `You do not need to see the entire staircase to lift your foot onto the first step.` },
  { category: "Motivation & Drive", text: `Discipline is choosing what you want most over what you want right now.` },

  // Inspiration & Vision
  { category: "Inspiration & Vision", text: `A clear vision turns ordinary effort into extraordinary purpose.` },
  { category: "Inspiration & Vision", text: `You carry the blueprint for a life nobody else has ever lived.` },
  { category: "Inspiration & Vision", text: `Storms do not come to destroy your path; they come to clear away what does not belong.` },
  { category: "Inspiration & Vision", text: `Light your own torch so others can find their way in the dark.` },
  { category: "Inspiration & Vision", text: `Limits are often just assumptions waiting to be challenged.` },
  { category: "Inspiration & Vision", text: `What you build in patience will outlast what you rush in pride.` },
  { category: "Inspiration & Vision", text: `Even the tallest oak began as an acorn that held its ground beneath the soil.` },
  { category: "Inspiration & Vision", text: `Courage is not the absence of doubt—it is moving forward while doubt is still talking.` },
  { category: "Inspiration & Vision", text: `Leave every room, project, and person slightly better than you found them.` },
  { category: "Inspiration & Vision", text: `Your potential is not defined by where you started, but by where you refuse to stop.` },

  // Dedication & Perseverance
  { category: "Dedication & Perseverance", text: `Dedication is showing up on Tuesday morning when the excitement of Monday has worn off.` },
  { category: "Dedication & Perseverance", text: `Consistency is the quiet superpower that separates dreamers from builders.` },
  { category: "Dedication & Perseverance", text: `Water cuts through solid stone not by force, but by never stopping.` },
  { category: "Dedication & Perseverance", text: `Loyalty to your craft means practicing even when nobody is applauding.` },
  { category: "Dedication & Perseverance", text: `Setbacks are detours, not dead ends.` },
  { category: "Dedication & Perseverance", text: `Mastery belongs to those who fall in love with the boredom of daily practice.` },
  { category: "Dedication & Perseverance", text: `Keep your promises to yourself—that is where unshakeable confidence is born.` },
  { category: "Dedication & Perseverance", text: `Endurance turns ordinary people into legends over time.` },
  { category: "Dedication & Perseverance", text: `Finish what you start; closure builds the muscle for bigger challenges.` },
  { category: "Dedication & Perseverance", text: `A decade of steady devotion will always outshine a year of frantic effort.` },

  // Study Habits & Daily Focus
  { category: "Study Habits & Daily Focus", text: `Put your phone in another room; your future self needs your undivided attention right now.` },
  { category: "Study Habits & Daily Focus", text: `Studying for two focused hours beats staring at an open textbook for six distracted ones.` },
  { category: "Study Habits & Daily Focus", text: `Highlighting a page feels like progress, but explaining the concept out loud proves you actually know it.` },
  { category: "Study Habits & Daily Focus", text: `Build a study routine so automatic that you do not have to negotiate with your mood every evening.` },
  { category: "Study Habits & Daily Focus", text: `Messy notes are fine; an unreviewed notebook is just expensive scrap paper.` },
  { category: "Study Habits & Daily Focus", text: `Study at the same desk and the same hour until your brain treats focus like a reflex.` },
  { category: "Study Habits & Daily Focus", text: `Master the boring fundamentals before chasing shortcuts.` },
  { category: "Study Habits & Daily Focus", text: `A clean desk clears half the static out of a crowded mind.` },
  { category: "Study Habits & Daily Focus", text: `Do not wait until you feel inspired to open your books; start for ten minutes and let momentum take over.` },
  { category: "Study Habits & Daily Focus", text: `Active recall hurts a little because your brain is actually growing stronger.` },

  // Exam Preparation & Test-Day Mindset
  { category: "Exam Preparation & Test-Day Mindset", text: `Practice under exam conditions today so test day feels like just another rehearsal.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Every practice question you get wrong now is a point you just saved on the real exam.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `An exam measures what you prepared on a Tuesday afternoon, not your worth as a human being.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Read the question twice before panicking once.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Cramming fills short-term memory like a leaky bucket; spaced repetition builds a reservoir.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `You do not need to know everything on earth—you only need to master the syllabus in front of you.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Walk into the exam hall knowing that calm precision beats frantic speed every time.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Treat past papers like a treasure map showing exactly where the traps are hidden.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Difficult chapters are not signs to quit; they are the exact places where you separate yourself from the crowd.` },
  { category: "Exam Preparation & Test-Day Mindset", text: `Trust the hours you logged when nobody was watching.` },

  // Overcoming Academic Burnout
  { category: "Overcoming Academic Burnout", text: `Rest is not a reward you earn after collapse; it is fuel required for the climb.` },
  { category: "Overcoming Academic Burnout", text: `Sleeping five hours to study three more is like driving faster with a punctured tire.` },
  { category: "Overcoming Academic Burnout", text: `When your brain refuses to absorb another word, close the book—a walk will teach you more than exhaustion ever could.` },
  { category: "Overcoming Academic Burnout", text: `Burnout happens when you measure your value by your hours instead of your recovery.` },
  { category: "Overcoming Academic Burnout", text: `Step away from the screen for twenty minutes; the syllabus will still be there when your eyes stop burning.` },
  { category: "Overcoming Academic Burnout", text: `A bad mock test score is data, not a verdict.` },
  { category: "Overcoming Academic Burnout", text: `Forgive yourself for yesterday’s wasted afternoon and win the next forty-five minutes.` },
  { category: "Overcoming Academic Burnout", text: `You cannot pour focus from a completely empty cup; hydrate, eat real food, and breathe.` },
  { category: "Overcoming Academic Burnout", text: `Sometimes the most productive thing a tired student can do is turn off the alarm and sleep.` },
  { category: "Overcoming Academic Burnout", text: `Progress in heavy seasons looks like showing up at seventy percent instead of disappearing completely.` },

  // Academic Resilience & Long-Term Perspective
  { category: "Academic Resilience & Long-Term Perspective", text: `Grades open certain doors, but the grit you build earning them keeps you standing once you walk through.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Confusion is the natural doorway to understanding—stay in the room long enough for the fog to clear.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Stop comparing your Chapter 2 to someone else’s Chapter 15.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Every scholar you admire once stared at a page that made zero sense.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Academic discipline is simply teaching yourself how to finish hard things on schedule.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `One tough semester does not define your intelligence or your future.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Ask the "dumb" question in class today so you do not miss the crucial mark on the final exam.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Small, unglamorous review sessions every morning quietly erase pre-exam panic.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `Protect your curiosity; exams end, but the ability to teach yourself anything lasts a lifetime.` },
  { category: "Academic Resilience & Long-Term Perspective", text: `You are allowed to feel overwhelmed, so long as you do not unpack and live there.` },

  // Quick Mantras for Tough Study Sessions
  { category: "Quick Mantras for Tough Study Sessions", text: `One page at a time, one problem at a time, one hour at a time.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Clarity comes from engagement, not avoidance.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Difficult now means easy later.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Do the hardest subject while your mind is sharpest.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Progress, not perfection, passes exams.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Close the twenty open tabs and finish the one task that matters.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Fatigue lies to you about your capabilities—rest first, decide tomorrow.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Your quiet persistence is louder than any fear of failure.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Show up for the work, then let go of the outcome.` },
  { category: "Quick Mantras for Tough Study Sessions", text: `Future you is already grateful you did not give up tonight.` },
];

/** Pick a random quote, never repeating the one currently on screen. */
export function shuffleQuote(currentIndex: number): { index: number; quote: Quote } {
  let next = currentIndex;
  if (QUOTES.length > 1) {
    while (next === currentIndex) next = Math.floor(Math.random() * QUOTES.length);
  }
  return { index: next, quote: QUOTES[next] };
}
