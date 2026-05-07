const ASPECTS = [
  { angle: 0,   orbSlow: 5, orbPersonal: 3, namePT: 'conjunção',   nameEN: 'conjunction',  scoreMod: 30 },
  { angle: 180, orbSlow: 5, orbPersonal: 3, namePT: 'oposição',    nameEN: 'opposition',   scoreMod: 25 },
  { angle: 90,  orbSlow: 5, orbPersonal: 3, namePT: 'quadratura',  nameEN: 'square',       scoreMod: 25 },
  { angle: 120, orbSlow: 5, orbPersonal: 3, namePT: 'trígono',     nameEN: 'trine',        scoreMod: 10 },
  { angle: 60,  orbSlow: 5, orbPersonal: 3, namePT: 'sextil',      nameEN: 'sextile',      scoreMod: 8  },
];

const SLOW_PLANETS   = ['Saturn', 'Jupiter', 'Uranus', 'Neptune', 'Pluto', 'True_Node', 'True_North_Lunar_Node', 'Chiron'];
const MEDIUM_PLANETS = ['Saturn', 'Jupiter'];
const OUTER_PLANETS  = ['Uranus', 'Neptune', 'Pluto'];

function impactScore(aspect) {
  const aspScore = aspect._asp.scoreMod;
  const tName = aspect.transit.name.toLowerCase();
  let planetScore = 0;
  if (['neptune','pluto','uranus','saturn'].some(p => tName.includes(p))) planetScore = 30;
  else if (tName.includes('jupiter'))                                       planetScore = 20;
  else if (['sun','moon'].some(p => tName.includes(p)))                    planetScore = 20;
  else if (['mars','venus','mercury'].some(p => tName.includes(p)))        planetScore = 15;
  else                                                                       planetScore = 10;
  const orb = aspect.orb;
  const durationScore = orb <= 1 ? 20 : orb <= 3 ? 10 : 5;
  return Math.min(100, aspScore + planetScore + durationScore);
}

function classifySpeed(planetName) {
  const n = planetName.toLowerCase();
  if (OUTER_PLANETS.some(p => n.includes(p)))  return 'lento';
  if (MEDIUM_PLANETS.some(p => n.includes(p))) return 'medio';
  return 'rapido';
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  const { skyPlanets, natalPlanets, natalContext, lang, name } = req.body;
  if (!skyPlanets || !natalPlanets) {
    return res.status(400).json({ error: 'Missing skyPlanets or natalPlanets' });
  }

  const isPT = lang === 'pt';

  // --- CALCULAR ASPECTOS CRUZADOS ---
  const rawAspects = [];
  for (const transit of skyPlanets) {
    if (transit.abs_pos == null) continue;
    for (const natal of natalPlanets) {
      if (natal.abs_pos == null) continue;
      const transitIsSlow = SLOW_PLANETS.some(s => transit.name.toLowerCase().includes(s.toLowerCase()));
      const natalIsSlow   = SLOW_PLANETS.some(s => natal.name.toLowerCase().includes(s.toLowerCase()));
      if (transitIsSlow && natalIsSlow) continue;

      const asp = findAspect(transit.abs_pos, natal.abs_pos, transit.name);
      if (!asp) continue;

      const entry = {
        transit: { name: transit.name, sign: transit.sign, degree: transit.degree, retrograde: transit.retrograde, abs_pos: transit.abs_pos },
        natal:   { name: natal.name,   sign: natal.sign,   degree: natal.degree,   house: natal.house, abs_pos: natal.abs_pos },
        aspect:  isPT ? asp.namePT : asp.nameEN,
        orb:     asp.orb,
        speed:   classifySpeed(transit.name),
        _asp:    asp,
      };
      entry.score = impactScore(entry);
      rawAspects.push(entry);
    }
  }

  const sorted = rawAspects.sort((a, b) => b.score - a.score);

  // Formatar aspectos para o Claude
  const rx  = p => p.retrograde ? ' Rx' : '';
  const fmt = a => {
    const houseStr = a.natal.house ? ` Casa ${a.natal.house}` : '';
    return `${a.transit.name}${rx(a.transit)} ${a.transit.sign} ${a.transit.degree?.toFixed(1)}° — ${a.aspect} (orbe ${a.orb}°) — natal ${a.natal.name} ${a.natal.sign} ${a.natal.degree?.toFixed(1)}°${houseStr} [${a.speed}|score:${a.score}]`;
  };

  const aspectBlock = sorted.length
    ? sorted.map(fmt).join('\n')
    : (isPT ? 'Nenhum aspecto ativo dentro dos orbes.' : 'No active aspects within orbs.');

  // --- PROMPT ---
  const system = isPT
    ? `Você é Orbita, motor de análise de trânsitos astrológicos.

Recebe aspectos ativos calculados (trânsito × natal) e transforma em análise por áreas da vida.

ORBES USADOS:
- Planetas pessoais (Sol, Lua, Mercúrio, Vênus, Marte): orbe máximo 3°
- Planetas lentos (Júpiter, Saturno, Urano, Netuno, Plutão): orbe máximo 5°

REGRAS DE ESCRITA:
- Use os planetas, signos e casas exatos da lista de aspectos.
- Descreva comportamento e circunstâncias concretas — não estados vagos.
- Proibido: "energia", "vibração", "portal", "jornada", "fluxo cósmico", "universo".
- Sem condicionais. Escreva no presente afirmativo.
- Se uma área não tem aspectos relevantes, escreva "Sem influências significativas hoje." — não invente.
- Cada área tem: resumo (1 frase do estado atual) + orientacao (1 frase do que fazer ou evitar).

ÁREAS E PLANETAS RELEVANTES:
- panorama_geral: todos os aspectos dominantes combinados
- amor: Vênus, Lua, Casa 7, Casa 5, Casa 8
- carreira: Sol, Saturno, Marte, Casa 10, Casa 6
- dinheiro: Vênus, Júpiter, Saturno, Casa 2, Casa 8
- vitalidade: Sol, Marte, Lua, Casa 1, Casa 6
- familia: Lua, Saturno, Casa 4
- vida_social: Mercúrio, Vênus, Júpiter, Casa 11, Casa 3

RETORNE APENAS este JSON válido, sem markdown, sem preâmbulo:

{
  "panorama_geral": {
    "resumo": "1 frase descrevendo o estado geral baseado nos aspectos dominantes.",
    "orientacao": "1 frase. O que priorizar ou evitar agora."
  },
  "amor": {
    "resumo": "1 frase sobre o estado afetivo e relacional.",
    "orientacao": "1 frase concreta."
  },
  "carreira": {
    "resumo": "1 frase sobre trabalho, propósito e direção.",
    "orientacao": "1 frase concreta."
  },
  "dinheiro": {
    "resumo": "1 frase sobre recursos, decisões financeiras e segurança material.",
    "orientacao": "1 frase concreta."
  },
  "vitalidade": {
    "resumo": "1 frase sobre disposição física e emocional.",
    "orientacao": "1 frase concreta."
  },
  "familia": {
    "resumo": "1 frase sobre dinâmicas familiares e base emocional.",
    "orientacao": "1 frase concreta."
  },
  "vida_social": {
    "resumo": "1 frase sobre conexões, comunicação e grupo.",
    "orientacao": "1 frase concreta."
  }
}`
    : `You are Orbita, an astrological transit analysis engine.

You receive active calculated aspects (transit × natal) and transform them into analysis by life areas.

ORBS USED:
- Personal planets (Sun, Moon, Mercury, Venus, Mars): max orb 3°
- Slow planets (Jupiter, Saturn, Uranus, Neptune, Pluto): max orb 5°

WRITING RULES:
- Use the exact planets, signs, and houses from the aspects list.
- Describe concrete behavior and circumstances — not vague states.
- Forbidden: "energy", "vibration", "portal", "journey", "cosmic flow", "universe".
- No conditionals. Write in present affirmative.
- If an area has no relevant aspects, write "No significant influences today." — do not invent.
- Each area has: resumo (1 sentence of current state) + orientacao (1 sentence of what to do or avoid).

AREAS AND RELEVANT PLANETS:
- panorama_geral: all dominant aspects combined
- amor: Venus, Moon, House 7, House 5, House 8
- carreira: Sun, Saturn, Mars, House 10, House 6
- dinheiro: Venus, Jupiter, Saturn, House 2, House 8
- vitalidade: Sun, Mars, Moon, House 1, House 6
- familia: Moon, Saturn, House 4
- vida_social: Mercury, Venus, Jupiter, House 11, House 3

RETURN ONLY this valid JSON, no markdown, no preamble:

{
  "panorama_geral": {
    "resumo": "1 sentence describing the general state based on dominant aspects.",
    "orientacao": "1 sentence. What to prioritize or avoid now."
  },
  "amor": {
    "resumo": "1 sentence about the affective and relational state.",
    "orientacao": "1 concrete sentence."
  },
  "carreira": {
    "resumo": "1 sentence about work, purpose, and direction.",
    "orientacao": "1 concrete sentence."
  },
  "dinheiro": {
    "resumo": "1 sentence about resources, financial decisions, and material security.",
    "orientacao": "1 concrete sentence."
  },
  "vitalidade": {
    "resumo": "1 sentence about physical and emotional disposition.",
    "orientacao": "1 concrete sentence."
  },
  "familia": {
    "resumo": "1 sentence about family dynamics and emotional base.",
    "orientacao": "1 concrete sentence."
  },
  "vida_social": {
    "resumo": "1 sentence about connections, communication, and group.",
    "orientacao": "1 concrete sentence."
  }
}`;

  const userMsg = `${isPT ? 'Nome' : 'Name'}: ${name || 'User'}

${isPT ? 'Aspectos ativos calculados (trânsito × natal):' : 'Active calculated aspects (transit × natal):'}
${aspectBlock}

${natalContext ? `${isPT ? 'Contexto natal:' : 'Natal context:'}\n${natalContext.substring(0, 2000)}` : ''}

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
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    if (!data.content || !data.content[0]) return res.status(500).json({ error: 'Empty response' });

    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return res.status(200).json({ ...parsed, _aspects: rawAspects });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
