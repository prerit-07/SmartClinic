// healthTips.js
// Short, specific, clinic-appropriate facts shown on the Patient waiting-room
// screen during idle states (Standby / Please Wait / Room Free). Deliberately
// avoids generic wellness-account filler ("drink more water!") in favor of
// concrete, mildly useful facts a patient might not already know.
//
// Categorized so the rotation can be tuned later (e.g. swap in seasonal tips
// during flu season) without touching component logic.

export const HEALTH_TIPS = [
  // ── General health ──────────────────────────────────────────────────
  {
    category: 'General',
    text: 'Blood pressure readings are typically highest in the morning and lowest at night — if you take BP medication, ask your doctor about the best time to dose it.',
  },
  {
    category: 'General',
    text: 'Sitting for long periods slows circulation. A 2–3 minute walk every hour helps as much as people assume it doesn\u2019t.',
  },
  {
    category: 'General',
    text: 'Adults need 7–9 hours of sleep. Consistently sleeping less raises long-term risk for heart disease and diabetes, not just tiredness.',
  },
  {
    category: 'General',
    text: 'A normal adult resting heart rate is 60–100 beats per minute. Lower can be normal for very fit people — ask your doctor if you\u2019re unsure.',
  },

  // ── Medicine safety ──────────────────────────────────────────────────
  {
    category: 'Medicine Safety',
    text: 'Some medicines (like many antibiotics) work best on an empty stomach, others (like ibuprofen) should be taken with food to avoid irritation. Always check the label or ask your pharmacist.',
  },
  {
    category: 'Medicine Safety',
    text: 'Never stop a prescribed antibiotic course early, even if you feel better — stopping early is one of the leading causes of antibiotic resistance.',
  },
  {
    category: 'Medicine Safety',
    text: 'Store most medicines in a cool, dry place — not the bathroom cabinet. Humidity from showers can degrade tablets faster than the printed expiry suggests.',
  },
  {
    category: 'Medicine Safety',
    text: 'Always tell your doctor about every medicine and supplement you\u2019re taking, including over-the-counter ones — drug interactions are a common cause of side effects.',
  },

  // ── Before your test/checkup ─────────────────────────────────────────
  {
    category: 'Before Your Visit',
    text: 'If you\u2019re here for a fasting blood test, water is still fine to drink — fasting means no food, not no fluids.',
  },
  {
    category: 'Before Your Visit',
    text: 'Avoid caffeine for at least 30 minutes before a blood pressure check — it can temporarily raise your reading.',
  },
  {
    category: 'Before Your Visit',
    text: 'Bring a list of your current medicines and dosages to every appointment — it saves time and avoids relying on memory.',
  },

  // ── Seasonal ─────────────────────────────────────────────────────────
  {
    category: 'Seasonal',
    text: 'During monsoon, drink only boiled or filtered water — waterborne illnesses like typhoid and hepatitis A spike during this season.',
  },
  {
    category: 'Seasonal',
    text: 'Heatstroke symptoms include confusion and dry skin despite heat — unlike heat exhaustion, where sweating continues. Both need prompt attention.',
  },
  {
    category: 'Seasonal',
    text: 'Flu season is a good time to ask your doctor whether a vaccine is right for you, especially if you\u2019re over 60 or have a chronic condition.',
  },

  // ── Everyday habits ──────────────────────────────────────────────────
  {
    category: 'Everyday Habits',
    text: 'Washing hands for 20 seconds (about the time it takes to hum a short tune twice) removes far more germs than a quick rinse.',
  },
  {
    category: 'Everyday Habits',
    text: 'Most adults need about half their body weight in ounces of water per day as a rough baseline — more in hot weather or with physical activity.',
  },
  {
    category: 'Everyday Habits',
    text: 'A diet with too much added salt is linked to high blood pressure — processed and packaged foods are usually the biggest hidden source, not the salt shaker.',
  },
];

/**
 * Returns a shuffled copy of the tips list so the rotation order isn't
 * identical every time the Patient screen loads.
 */
export function shuffledTips() {
  const copy = [...HEALTH_TIPS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
