// Aspect definitions: [angle, orb for slow transits, orb for personal transits, name_pt, name_en]
const ASPECTS = [
  { angle: 0,   orbSlow: 8, orbPersonal: 6, namePT: 'conjunção',   nameEN: 'conjunction' },
  { angle: 60,  orbSlow: 5, orbPersonal: 4, namePT: 'sextil',      nameEN: 'sextile' },
  { angle: 90,  orbSlow: 7, orbPersonal: 5, namePT: 'quadratura',  nameEN: 'square' },
  { angle: 120, orbSlow: 7, orbPersonal: 5, namePT: 'trígono',     nameEN: 'trine' },
  { angle: 180, orbSlow: 8, orbPersonal: 6, namePT: 'oposição',    nameEN: 'opposition' },
];

const SLOW_PLANETS = ['Saturn', 'Jupiter', 'Uranus', 'Neptune', 'Pluto', 'True_Node', 'True_North_Lunar_Node'];

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function findAspect(transitAbsPos, natalAbsPos, transitName) {
  const isSlow = SLOW_PLANETS.some(s => transitName.toLowerCase().includes(s.toLowerCase()));
  const dist = angularDistance(transitAbsPos, natalAbsPos);
  for (const asp of ASPECTS) {
    const orb = isSlow ? asp.orbSlow : asp.orbPersonal;
    const diff = Math.abs(dist - asp.angle);
    if (diff <= orb) {
      return { ...asp, orb: parseFloat(diff.toFixed(2)) };
    }
  }
  return null;
}

// Classify transit duration by transiting planet speed
function classifyDuration(planetName) {
  const name = planetName.toLowerCase();
  if (['pluto', 'neptune', 'uranus'].some(p => name.includes(p))) return 'longo';
  if (['saturn', 'jupiter'].some(p => name.includes(p))) return 'medio';
  return 'curto';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  // skyPlanets: [{name, sign, abs_pos, degree, retrograde}]
  // natalPlanets: [{name, sign, abs_pos, degree, house}]
  const { skyPlanets, natalPlanets, natalContext, lang, name } = req.body;

  if (!skyPlanets || !natalPlanets) {
    return res.status(400).json({ error: 'Missing skyPlanets or natalPlanets' });
  }

  const isPT = lang === 'pt';

  // --- CALCULATE CROSS-ASPECTS ---
  const aspects = [];
  for (const transit of skyPlanets) {
    if (transit.abs_pos === null) continue;
    for (const natal of natalPlanets) {
      if (natal.abs_pos === null) continue;
      // Skip slow-to-slow (e.g. Neptune transit → natal Pluto)
      const transitIsSlow = SLOW_PLANETS.some(s => transit.name.toLowerCase().includes(s.toLowerCase()));
      const natalIsSlow = SLOW_PLANETS.some(s => natal.name.toLowerCase().includes(s.toLowerCase()));
      if (transitIsSlow && natalIsSlow) continue;

      const asp = findAspect(transit.abs_pos, natal.abs_pos, transit.name);
      if (asp) {
        aspects.push({
          transit: { name: transit.name, sign: transit.sign, degree: transit.degree, retrograde: transit.retrograde },
          natal: { name: natal.name, sign: natal.sign, degree: natal.degree, house: natal.house },
          aspect: isPT ? asp.namePT : asp.nameEN,
          orb: asp.orb,
          duration: classifyDuration(transit.name),
        });
      }
    }
  }

  // Sort: slow planets first, then by orb
  aspects.sort((a, b) => {
    const aScore = SLOW_PLANETS.some(s => a.transit.name.toLowerCase().includes(s.toLowerCase())) ? 0 : 1;
    const bScore = SLOW_PLANETS.some(s => b.transit.name.toLowerCase().includes(s.toLowerCase())) ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return a.orb - b.orb;
  });

  // Format aspect list for Claude — precise and structured
  const rx = p => p.retrograde ? ' Rx' : '';
  const fmt = a =>
    `${a.transit.name}${rx(a.transit)} ${a.transit.sign} ${a.transit.degree?.toFixed(1)}° — ${a.aspect} (orbe ${a.orb}°) — natal ${a.natal.name} ${a.natal.sign} ${a.natal.degree?.toFixed(1)}° Casa ${a.natal.house ?? '?'} [${a.duration}]`;

  const aspectBlock = aspects.length
    ? aspects.map(fmt).join('\n')
    : (isPT ? 'Nenhum aspecto significativo encontrado.' : 'No significant aspects found.');

  const system = isPT
    ? `Você é Orbita, motor de análise astrológica de trânsitos.

Você recebe uma lista de aspectos já calculados (planetas do céu atual × mapa natal da pessoa) e o contexto natal.
Sua função: transformar esses dados em análise comportamental precisa, em 6 seções.

PRINCÍPIOS:
- Seja específico ao mapa desta pessoa. Use os planetas, signos e casas mencionados.
- Descreva comportamento e circunstâncias concretas — não estados de ânimo vagos.
- Hierarquize: planetas lentos (Saturno, Júpiter, Plutão, Urano, Netuno) têm mais peso.
- Para cada seção, use apenas os aspectos mais relevantes — não force todos.
- Nada de: "energia", "vibração", "portal", "jornada", "despertar", "fluxo cósmico".
- Nada de condicionais ("pode ser que", "talvez"). Escreva no presente afirmativo.
- Termine cada ação com um verbo no imperativo e algo concreto, não genérico.

RETORNE APENAS este JSON válido, sem markdown, sem preâmbulo:

{
  "mais_importante": {
    "transit_display": "Ex: Saturno ♄ Peixes 2° — quadratura — Sol natal ♀ Sagitário 29° Casa 5",
    "title": "Título curto e preciso do trânsito mais dominante",
    "aspect": "tipo do aspecto",
    "orb": "número",
    "description": "3-4 frases. O que este trânsito está causando concretamente agora — no comportamento, nas circunstâncias, nas emoções. Use o signo e a casa natal. Sem condicionais.",
    "action": "Ação concreta e específica para esta semana. Começa com verbo no imperativo."
  },
  "mudancas_recentes": [
    {
      "transit_display": "Ex: Júpiter ♃ Câncer 18° — conjunção — Vênus natal ♀ Câncer 20° Casa 7",
      "title": "Título",
      "aspect": "tipo",
      "orb": "número",
      "description": "2 frases. O que mudou recentemente.",
      "action": "Ação concreta."
    }
  ],
  "ainda_ativas": [
    {
      "transit_display": "string",
      "title": "Título",
      "aspect": "tipo",
      "orb": "número",
      "description": "2 frases.",
      "action": "Ação concreta."
    }
  ],
  "longo_prazo": [
    {
      "transit_display": "string",
      "title": "Título",
      "aspect": "tipo",
      "orb": "número",
      "description": "2-3 frases. O que está sendo transformado estruturalmente nos próximos meses.",
      "action": "Como trabalhar com isso."
    }
  ],
  "terminando": [
    {
      "transit_display": "string",
      "title": "Título",
      "aspect": "tipo",
      "orb": "número",
      "description": "1-2 frases. O que está encerrando.",
      "action": "Como fechar este ciclo."
    }
  ],
  "como_esta_vendo_a_vida": {
    "humor": "uma palavra: expansivo / contraído / acelerado / lento / intenso / leve / confuso / focado",
    "filtro": "2-3 frases. O filtro emocional e mental desta pessoa agora — baseado nos trânsitos dominantes. Específico.",
    "cuidado": "1-2 frases. O maior risco de distorção da realidade que ela corre agora.",
    "perguntas": [
      "Pergunta clicável 1 — específica ao trânsito mais intenso, com planeta e casa mencionados",
      "Pergunta clicável 2 — sobre emoções ou relacionamentos baseada nos aspectos reais",
      "Pergunta clicável 3 — sobre trabalho ou decisões baseada nos aspectos reais",
      "Pergunta clicável 4 — sobre o padrão mais desafiador identificado nos aspectos"
    ]
  }
}`
    : `You are Orbita, a transit astrology analysis engine.

You receive a pre-calculated list of aspects (current sky planets × this person's natal chart) and natal context.
Your job: turn this data into precise behavioral analysis in 6 sections.

PRINCIPLES:
- Be specific to this person's chart. Use the planets, signs, and houses mentioned.
- Describe concrete behavior and circumstances — not vague moods.
- Prioritize: slow planets (Saturn, Jupiter, Pluto, Uranus, Neptune) carry more weight.
- Per section, use the most relevant aspects — don't force all of them.
- No: "energy", "vibration", "portal", "journey", "awakening", "cosmic flow".
- No conditionals ("might be", "perhaps"). Write in present affirmative.
- End each action with an imperative verb and something concrete, not generic.

RETURN ONLY this valid JSON, no markdown, no preamble:

{
  "mais_importante": {
    "transit_display": "Ex: Saturn ♄ Pisces 2° — square — natal Sun ☉ Sagittarius 29° House 5",
    "title": "Short precise title of the most dominant transit",
    "aspect": "aspect type",
    "orb": "number",
    "description": "3-4 sentences. What this transit is concretely doing now — to behavior, circumstances, emotions. Use the sign and natal house. No conditionals.",
    "action": "Concrete, specific action for this week. Starts with an imperative verb."
  },
  "mudancas_recentes": [
    {
      "transit_display": "Ex: Jupiter ♃ Cancer 18° — conjunction — natal Venus ♀ Cancer 20° House 7",
      "title": "Title",
      "aspect": "type",
      "orb": "number",
      "description": "2 sentences. What recently changed.",
      "action": "Concrete action."
    }
  ],
  "ainda_ativas": [
    {
      "transit_display": "string",
      "title": "Title",
      "aspect": "type",
      "orb": "number",
      "description": "2 sentences.",
      "action": "Concrete action."
    }
  ],
  "longo_prazo": [
    {
      "transit_display": "string",
      "title": "Title",
      "aspect": "type",
      "orb": "number",
      "description": "2-3 sentences. What is being structurally transformed over the coming months.",
      "action": "How to work with this."
    }
  ],
  "terminando": [
    {
      "transit_display": "string",
      "title": "Title",
      "aspect": "type",
      "orb": "number",
      "description": "1-2 sentences. What is ending.",
      "action": "How to close this cycle."
    }
  ],
  "como_esta_vendo_a_vida": {
    "humor": "one word: expansive / contracted / accelerated / slow / intense / light / confused / focused",
    "filtro": "2-3 sentences. This person's emotional and mental filter right now — based on dominant transits. Specific.",
    "cuidado": "1-2 sentences. The biggest risk of reality distortion they face right now.",
    "perguntas": [
      "Clickable question 1 — specific to the most intense transit, naming the planet and house",
      "Clickable question 2 — about emotions or relationships based on real aspects",
      "Clickable question 3 — about work or decisions based on real aspects",
      "Clickable question 4 — about the most challenging pattern identified in the aspects"
    ]
  }
}`;

  const userMsg = `${isPT ? 'Nome' : 'Name'}: ${name || 'User'}

${isPT ? 'Aspectos calculados (trânsito × natal):' : 'Calculated aspects (transit × natal):'}
${aspectBlock}

${natalContext ? `${isPT ? 'Contexto natal adicional:' : 'Additional natal context:'}\n${natalContext.substring(0, 2000)}` : ''}

${isPT ? 'Retorne APENAS o JSON válido.' : 'Return ONLY valid JSON.'}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    if (!data.content || !data.content[0]) return res.status(500).json({ error: 'Empty response' });

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    // Also return the raw aspects list so the frontend can display the aspect table
    return res.status(200).json({ ...parsed, _aspects: aspects });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
