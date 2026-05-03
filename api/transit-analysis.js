const ASPECTS = [
  { angle: 0,   orbSlow: 8, orbPersonal: 6, namePT: 'conjunção',   nameEN: 'conjunction',  scoreMod: 30 },
  { angle: 180, orbSlow: 8, orbPersonal: 6, namePT: 'oposição',    nameEN: 'opposition',   scoreMod: 25 },
  { angle: 90,  orbSlow: 7, orbPersonal: 5, namePT: 'quadratura',  nameEN: 'square',       scoreMod: 25 },
  { angle: 120, orbSlow: 7, orbPersonal: 5, namePT: 'trígono',     nameEN: 'trine',        scoreMod: 10 },
  { angle: 60,  orbSlow: 5, orbPersonal: 4, namePT: 'sextil',      nameEN: 'sextile',      scoreMod: 8  },
];

const SLOW_PLANETS   = ['Saturn', 'Jupiter', 'Uranus', 'Neptune', 'Pluto', 'True_Node', 'True_North_Lunar_Node', 'Chiron'];
const MEDIUM_PLANETS = ['Saturn', 'Jupiter'];
const OUTER_PLANETS  = ['Uranus', 'Neptune', 'Pluto'];

// Score de impacto 0–100 por aspecto
function impactScore(aspect) {
  // A) Tipo de aspecto
  const aspScore = aspect._asp.scoreMod;

  // B) Planeta em trânsito
  const tName = aspect.transit.name.toLowerCase();
  let planetScore = 0;
  if (['neptune','pluto','uranus','saturn'].some(p => tName.includes(p))) planetScore = 30;
  else if (tName.includes('jupiter'))                                       planetScore = 20;
  else if (['sun','moon'].some(p => tName.includes(p)))                    planetScore = 20;
  else if (['mars','venus','mercury'].some(p => tName.includes(p)))        planetScore = 15;
  else                                                                       planetScore = 10;

  // C) Duração (orbe como proxy de intensidade)
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
      if (transitIsSlow && natalIsSlow) continue; // ignora lento × lento

      const asp = findAspect(transit.abs_pos, natal.abs_pos, transit.name);
      if (!asp) continue;

      const entry = {
        transit: { name: transit.name, sign: transit.sign, degree: transit.degree, retrograde: transit.retrograde, abs_pos: transit.abs_pos },
        natal:   { name: natal.name,   sign: natal.sign,   degree: natal.degree,   house: natal.house,             abs_pos: natal.abs_pos   },
        aspect:  isPT ? asp.namePT : asp.nameEN,
        orb:     asp.orb,
        speed:   classifySpeed(transit.name),
        _asp:    asp,
      };
      entry.score = impactScore(entry);
      rawAspects.push(entry);
    }
  }

  // --- CATEGORIZAR: hoje vs fase_atual ---
  const sorted = rawAspects.sort((a, b) => b.score - a.score);

  // HOJE: score >= 55, planetas rápidos ou médios, max 5
  const hoje = sorted
    .filter(a => a.score >= 55 && (a.speed === 'rapido' || a.speed === 'medio'))
    .slice(0, 5);

  // FASE ATUAL: score >= 50, planetas lentos
  const faseAtual = sorted
    .filter(a => a.score >= 50 && a.speed === 'lento')
    .slice(0, 6);

  // Formatar para o Claude
  const rx  = p => p.retrograde ? ' Rx' : '';
  const fmt = (a, category) => {
    const houseStr = a.natal.house ? ` Casa ${a.natal.house}` : '';
    return `[${category}|score:${a.score}] ${a.transit.name}${rx(a.transit)} ${a.transit.sign} ${a.transit.degree?.toFixed(1)}° — ${a.aspect} (orbe ${a.orb}°) — natal ${a.natal.name} ${a.natal.sign} ${a.natal.degree?.toFixed(1)}°${houseStr}`;
  };

  const hojeBlock     = hoje.length     ? hoje.map(a => fmt(a, 'HOJE')).join('\n')         : (isPT ? 'Nenhum aspecto relevante hoje.' : 'No relevant aspects today.');
  const faseBlock     = faseAtual.length ? faseAtual.map(a => fmt(a, 'FASE_ATUAL')).join('\n') : (isPT ? 'Nenhum trânsito longo ativo.' : 'No long-term transits active.');
  const aspectosRaw   = [...hoje, ...faseAtual];

  // --- PROMPT ---
  const system = isPT
    ? `Você é Orbita, motor de análise astrológica de trânsitos.
Recebe aspectos já calculados e categorizados em duas listas:
- [HOJE]: aspectos de curto prazo que afetam comportamento imediato
- [FASE_ATUAL]: trânsitos lentos que definem o período psicológico atual

Sua função: transformar esses dados em análise comportamental precisa em 2 seções.

REGRAS DE ESCRITA:
- Seja específico ao mapa desta pessoa. Use os planetas, signos e casas exatos.
- Descreva comportamento concreto e circunstâncias — não estados de ânimo vagos.
- Nada de: "energia", "vibração", "portal", "jornada", "despertar", "fluxo cósmico".
- Nada de condicionais ("pode ser que", "talvez"). Escreva no presente afirmativo.
- Cada card tem EXATAMENTE 4 campos:
  * evento: "[Planeta] [aspecto] [Planeta natal]" — só os nomes, sem graus
  * significado: uma frase. A tensão ou fluxo astrológico em termos psicológicos.
  * vida_real: uma frase. Como isso aparece no dia a dia desta pessoa — específico à casa e signo natal.
  * orientacao: uma frase. O que fazer ou evitar. Começa com verbo no imperativo.

RETORNE APENAS este JSON válido, sem markdown, sem preâmbulo:

{
  "hoje": {
    "resumo": "1 frase descrevendo o tom geral do dia baseado nos aspectos de hoje.",
    "cards": [
      {
        "evento": "Mercúrio quadratura Lua natal",
        "significado": "Mente e emoção em conflito — tendência a interpretar falas de forma emocional.",
        "vida_real": "Conversas na Casa 3 tendem a escalar rapidamente hoje.",
        "orientacao": "Evite tomar decisões importantes até a noite."
      }
    ]
  },
  "fase_atual": {
    "resumo": "1 frase descrevendo o processo psicológico dominante deste período.",
    "cards": [
      {
        "evento": "Saturno quadratura Sol natal",
        "significado": "Pressão estrutural sobre identidade — o que foi construído está sendo testado.",
        "vida_real": "Responsabilidades profissionais aumentam enquanto a motivação oscila na Casa 9.",
        "orientacao": "Reduza o escopo dos projetos e entregue o que já começou."
      }
    ]
  },
  "como_esta_vendo_a_vida": {
    "humor": "uma palavra: expansivo / contraído / acelerado / lento / intenso / leve / confuso / focado",
    "filtro": "2 frases. O filtro emocional desta pessoa agora — baseado nos trânsitos dominantes.",
    "cuidado": "1 frase. O maior risco de distorção da realidade agora.",
    "perguntas": [
      "Pergunta específica ao trânsito mais intenso de hoje, com planeta e casa",
      "Pergunta sobre emoções ou relacionamentos baseada nos aspectos reais",
      "Pergunta sobre trabalho ou decisões baseada nos aspectos reais",
      "Pergunta sobre o padrão mais desafiador identificado na fase atual"
    ]
  }
}`
    : `You are Orbita, a transit astrology analysis engine.
You receive pre-calculated aspects in two categorized lists:
- [TODAY]: short-term aspects affecting immediate behavior
- [CURRENT_PHASE]: slow transits defining the current psychological period

Your job: turn this data into precise behavioral analysis in 2 sections.

WRITING RULES:
- Be specific to this person's chart. Use the exact planets, signs, and houses.
- Describe concrete behavior and circumstances — not vague moods.
- No: "energy", "vibration", "portal", "journey", "awakening", "cosmic flow".
- No conditionals ("might be", "perhaps"). Write in present affirmative.
- Each card has EXACTLY 4 fields:
  * evento: "[Planet] [aspect] [natal Planet]" — names only, no degrees
  * significado: one sentence. The astrological tension or flow in psychological terms.
  * vida_real: one sentence. How this appears in daily life — specific to the natal house and sign.
  * orientacao: one sentence. What to do or avoid. Starts with an imperative verb.

RETURN ONLY this valid JSON, no markdown, no preamble:

{
  "hoje": {
    "resumo": "1 sentence describing the general tone of the day based on today's aspects.",
    "cards": [
      {
        "evento": "Mercury square natal Moon",
        "significado": "Mind and emotion in conflict — tendency to interpret words emotionally.",
        "vida_real": "Conversations in House 3 tend to escalate quickly today.",
        "orientacao": "Avoid making important decisions until the evening."
      }
    ]
  },
  "fase_atual": {
    "resumo": "1 sentence describing the dominant psychological process of this period.",
    "cards": [
      {
        "evento": "Saturn square natal Sun",
        "significado": "Structural pressure on identity — what was built is being tested.",
        "vida_real": "Professional responsibilities increase while motivation oscillates in House 9.",
        "orientacao": "Reduce the scope of projects and deliver what you already started."
      }
    ]
  },
  "como_esta_vendo_a_vida": {
    "humor": "one word: expansive / contracted / accelerated / slow / intense / light / confused / focused",
    "filtro": "2 sentences. This person's emotional filter right now — based on dominant transits.",
    "cuidado": "1 sentence. The biggest risk of reality distortion right now.",
    "perguntas": [
      "Question specific to the most intense today transit, naming planet and house",
      "Question about emotions or relationships based on real aspects",
      "Question about work or decisions based on real aspects",
      "Question about the most challenging pattern in the current phase"
    ]
  }
}`;

  const userMsg = `${isPT ? 'Nome' : 'Name'}: ${name || 'User'}

${isPT ? 'ASPECTOS DE HOJE (curto prazo):' : 'TODAY ASPECTS (short-term):'}
${hojeBlock}

${isPT ? 'FASE ATUAL (trânsitos lentos):' : 'CURRENT PHASE (slow transits):'}
${faseBlock}

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
        max_tokens: 3000,
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
