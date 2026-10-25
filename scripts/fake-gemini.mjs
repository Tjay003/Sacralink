import http from 'node:http';

const PORT = Number(process.env.FAKE_GEMINI_PORT || process.env.PORT || 54399);

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'fake-gemini' }));
  }

  if (req.method === 'POST' && url.pathname.includes(':embedContent')) {
    const keyParam = url.searchParams.get('key') || '';
    const simulateKeyQuotaHeader =
      req.headers['x-test-simulate-key-quota'] || req.headers['x-test-simulate-quota-key'];
    if (
      keyParam.includes('exhausted') ||
      keyParam.includes('rate-limit') ||
      (simulateKeyQuotaHeader && simulateKeyQuotaHeader === keyParam)
    ) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          error: {
            code: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
            status: 'RESOURCE_EXHAUSTED',
          },
        })
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        embedding: {
          values: new Array(768).fill(0.01),
        },
      })
    );
  }

  if (req.method === 'POST' && url.pathname.includes(':generateContent')) {
    let bodyText = '';
    for await (const chunk of req) {
      bodyText += chunk;
    }

    try {
      const body = JSON.parse(bodyText);
      const { contents = [], system_instruction } = body;

      // Extract model name from pathname, e.g. /v1beta/models/gemini-2.5-flash:generateContent
      const modelMatch = url.pathname.match(/\/models\/([^:]+):generateContent/);
      const modelName = modelMatch ? modelMatch[1] : '';

      const keyParam = url.searchParams.get('key') || '';
      const simulateKeyQuotaHeader =
        req.headers['x-test-simulate-key-quota'] || req.headers['x-test-simulate-quota-key'];
      const simulateQuotaHeader =
        req.headers['x-test-simulate-quota'] === 'true' ||
        req.headers['x-test-simulate-quota'] === '1';

      if (
        modelName === 'simulate-quota-first-model' ||
        (simulateQuotaHeader && (modelName === 'gemini-2.5-flash' || modelName.includes('first'))) ||
        keyParam.includes('exhausted') ||
        keyParam.includes('rate-limit') ||
        (simulateKeyQuotaHeader && simulateKeyQuotaHeader === keyParam)
      ) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED',
            },
          })
        );
      }

      // Extract church ID from system instruction if present
      const systemText = system_instruction?.parts?.[0]?.text || '';
      const matchChurch = systemText.match(/parish ID:\s*([a-f0-9-]+)/i);
      const churchId = matchChurch ? matchChurch[1] : '';

      // Extract user message texts
      const userText = contents
        .filter((c) => c.role === 'user')
        .flatMap((c) => c.parts || [])
        .map((p) => p.text || '')
        .join(' ');

      const lastUserTurn = [...contents].reverse().find((c) => c.role === 'user');
      const lastUserText = lastUserTurn?.parts?.map((p) => p.text || '').join(' ') || userText;

      // Polish Knowledge / AI Scribe request
      const isPolishRequest =
        systemText.includes('pastoral communications director') ||
        /polish the following/i.test(userText) ||
        /AI Scribe/i.test(systemText);

      if (isPolishRequest) {
        const titleMatch = userText.match(/Draft Title:\s*([^\r\n]+)/i);
        const contentMatch = userText.match(/Draft Content:\s*([\s\S]+?)(?:Return ONLY|$)/i);
        const draftTitle = titleMatch ? titleMatch[1].trim() : 'Parish Guidelines';
        const draftContent = contentMatch ? contentMatch[1].trim() : userText;

        let polishedTitle = draftTitle;
        if (draftTitle.toLowerCase().includes('dress') || draftContent.toLowerCase().includes('dress') || draftContent.toLowerCase().includes('sleeveless') || draftContent.toLowerCase().includes('sumbrero')) {
          polishedTitle = 'Church Dress Code & Liturgical Decorum';
        } else if (draftTitle.toLowerCase().includes('baptism') || draftContent.toLowerCase().includes('binyag')) {
          polishedTitle = 'Holy Baptism Requirements & Godparent Guidelines';
        } else if (draftTitle.toLowerCase().includes('wedding') || draftContent.toLowerCase().includes('kasal')) {
          polishedTitle = 'Wedding Requirements & Document Timeline';
        }

        const lines = draftContent
          .split('\n')
          .map((l) => l.trim().replace(/^[-*•\d.]\s*/, ''))
          .filter(Boolean);

        const bullets = lines.length > 0
          ? lines.map((l) => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n')
          : '• Please observe reverent liturgical decorum and pastoral guidance.';

        const polishedPayload = {
          polishedTitle,
          polishedContent: `### Liturgical Decorum & Parish Policy\n\nTo preserve the sanctity of our church and foster a prayerful environment for all worshippers, our parish kindly requests your faithful cooperation with the following guidelines:\n\n${bullets}\n\n*We thank you for your understanding and reverence in the House of God.*`,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: JSON.stringify(polishedPayload) }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // Check if there is a functionResponse in any turn
      let functionResponsePart = null;
      for (const turn of contents) {
        if (Array.isArray(turn.parts)) {
          for (const part of turn.parts) {
            if (part.functionResponse) {
              functionResponsePart = part.functionResponse;
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // Step 2 of function calling: Gemini receives function output and crafts natural language reply
      // ----------------------------------------------------------------------
      if (functionResponsePart) {
        const { name, response } = functionResponsePart;

        // 1. get_mass_schedule
        if (name === 'get_mass_schedule') {
          const schedules = response?.schedules || [];
          const isTagalog = /po\b|opo\b|ano\b|kailan\b|simba\b/i.test(lastUserText);
          let replyText = '';
          if (schedules.length === 0) {
            replyText = isTagalog
              ? 'Wala pa pong nakatalang iskedyul ng Misa para sa parokyang ito sa kasalukuyan.'
              : 'There are no scheduled Masses posted for this parish at the moment.';
          } else {
            const list = schedules
              .map(
                (s) =>
                  `• ${s.day_of_week} at ${s.time}${s.language ? ` (${s.language})` : ''}`
              )
              .join('\n');
            replyText = isTagalog
              ? `Narito po ang kasalukuyang iskedyul ng Banal na Misa sa parokya:\n${list}`
              : `Here is the current Mass schedule:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 2. get_my_appointments
        if (name === 'get_my_appointments') {
          const appointments = response?.appointments || [];
          const isTagalog = /po\b|opo\b|ano\b|ko\b|mga\b/i.test(lastUserText);
          let replyText = '';
          if (appointments.length === 0) {
            replyText = isTagalog
              ? 'Wala pa po kayong anumang nakatalang appointment sa kasalukuyan.'
              : 'You do not have any appointments scheduled at this moment.';
          } else {
            const list = appointments
              .map((a) => {
                let details = `• ${a.service_type} sa ${a.church?.name || 'parokya'} sa ${a.appointment_date} ng ${a.appointment_time} (Status: ${a.status})`;
                if (a.notes) {
                  details += ` - Notes: ${a.notes}`;
                }
                if (a.rescheduled_from_date) {
                  details += ` [Rescheduled from ${a.rescheduled_from_date}${a.reschedule_reason ? `: ${a.reschedule_reason}` : ''}]`;
                }
                return details;
              })
              .join('\n');
            replyText = isTagalog
              ? `Narito po ang inyong mga nakatalang appointment:\n${list}`
              : `Here are your scheduled appointments:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 3. check_priest_availability
        // MANDATORY PRIVACY: Always reply with yes/no only. Never mention reasons.
        if (name === 'check_priest_availability') {
          const isAvailable = Boolean(response?.available);
          const replyText = isAvailable
            ? 'Yes, Father is available at that date and time.'
            : 'No, Father is not available at that date and time. Please contact the parish office for alternative schedules.';

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 4. find_mass_across_parishes
        if (name === 'find_mass_across_parishes') {
          const schedules = response?.schedules || [];
          let replyText = '';
          if (schedules.length === 0) {
            replyText = 'No Mass schedules were found across parishes for that day.';
          } else {
            const list = schedules
              .map(
                (s) =>
                  `• ${s.church?.name || 'Parish'}: ${s.day_of_week} at ${s.time}${s.language ? ` (${s.language})` : ''}`
              )
              .join('\n');
            replyText = `Here are the Mass schedules across parishes:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 5. get_bookable_services
        if (name === 'get_bookable_services') {
          const services = response?.services || [];
          let replyText = '';
          if (services.length === 0) {
            replyText = 'There are no active bookable services for this parish at the moment.';
          } else {
            const list = services
              .map((s) => `• ${s.name}${s.description ? `: ${s.description}` : ''}`)
              .join('\n');
            replyText = `Here are the bookable services for this parish:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 6. get_sacrament_requirements
        if (name === 'get_sacrament_requirements') {
          const requirements = response?.requirements || [];
          const isTagalog = /po\b|opo\b|ano\b|kailangan\b|mga\b/i.test(lastUserText);
          let replyText = '';
          if (requirements.length === 0) {
            replyText = isTagalog
              ? 'Wala pong partikular na dokumentong kailangan para sa sakramentong ito.'
              : 'There are no specific document requirements listed for this sacrament.';
          } else {
            const list = requirements
              .map(
                (r) =>
                  `• ${r.requirement_name}${r.is_required ? (isTagalog ? ' (Kailangan)' : ' (Required)') : (isTagalog ? ' (Opsyonal)' : ' (Optional)')}${r.description ? `: ${r.description}` : ''}`
              )
              .join('\n');
            replyText = isTagalog
              ? `Narito po ang mga kailangang dokumento para sa sakramento:\n${list}`
              : `Here are the requirements:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 7. check_slot_availability
        if (name === 'check_slot_availability') {
          const available = Boolean(response?.available);
          const replyText = available
            ? 'Yes, that slot is available for booking.'
            : 'The selected slot is unavailable. Please select an alternative slot or change the date and time.';

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 8. list_parishes
        if (name === 'list_parishes') {
          const parishes = response?.parishes || [];
          let replyText = '';
          if (parishes.length === 0) {
            replyText = 'No active parishes found.';
          } else {
            const list = parishes
              .map((p) => `• ${p.name}${p.address ? ` (${p.address})` : ''}`)
              .join('\n');
            replyText = `Here are the active parishes in the diocese:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }

        // 9. search_church_knowledge
        if (name === 'search_church_knowledge') {
          const results = response?.results || [];
          let replyText = '';
          if (results.length === 0) {
            replyText = "I'm sorry, I don't have that information. Please contact the parish office.";
          } else {
            const list = results.map((r) => r.content || r.title).join('\n\n');
            replyText = `Here is what I found:\n${list}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ text: replyText }],
                  },
                  finishReason: 'STOP',
                },
              ],
            })
          );
        }
      }

      // ----------------------------------------------------------------------
      // Step 1: Detect intent and trigger functionCall
      // ----------------------------------------------------------------------
      const matchDraft = systemText.match(/Current Step:\s*([a-z]+)/i);
      const currentBookingStep = matchDraft ? matchDraft[1].toLowerCase() : null;

      // 0. Language preference confirmation ("pwede po tagalog?", "can we speak tagalog?", etc.)
      if (/(?:pwede|maaari)\s+po\s+(?:bang?\s+)?tagalog|mag[-\s]?tagalog\s+tayo|speak\s+tagalog|tagalog\s+please/i.test(lastUserText)) {
        const replyText = "Opo, maaari po tayong mag-usap sa Tagalog! Ako po ang inyong Sacralink Parish Assistant. Ano po ang maipaglilingkod ko sa inyo tungkol sa ating mga misa, sakramento, o mga gawain sa parokya? 🙏";
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0. Side Question Mid-Booking (e.g. "What is a Pre-Jordan seminar?")
      if (/pre-jordan/i.test(lastUserText)) {
        const isTagalog = /ano\s+ang|po\b|opo\b/i.test(lastUserText);
        const replyText = isTagalog
          ? 'Ang Pre-Jordan seminar po ay isang catechetical formation session para sa mga magulang at ninong/ninang bago ang pagdiriwang ng Binyag.'
          : 'The Pre-Jordan seminar is a required catechetical preparation session for parents and godparents prior to the christening.';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.00 Off-topic query guard (e.g. "sino po si lebron", sports, politics, weather, recipes)
      if (
        /(?:lebron|kobe|(?<!pre-)\bjordan\b|nba|basketball|crypto|bitcoin|weather|panahon|presidency|pulitika|recipe|luto|movie|sine|sino\s+(?:po\s+)?si\s+(?!jesus|maria|jose|san\b|santa\b|fr\b|father\b))/i.test(
          lastUserText
        )
      ) {
        const isTagalog = /po\b|opo\b|sino\b|ano\b|ba\b/i.test(lastUserText);
        const replyText = isTagalog
          ? "Paumanhin po, ngunit nakalaan lamang po ako para sa mga katanungan ukol sa ating parokya: mga banal na misa, sakramento, mga schedule, at mga pastoral na gawain ng simbahan. May maitutulong po ba ako sa inyo tungkol sa Our Lady of Lourdes Parish?"
          : "I can only help with parish-related questions such as Mass schedules, sacraments, requirements, and church appointments. Is there something about our parish I can help you with?";

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.01 Intent: Talk to the parish office / Draft ticket
      if (
        /(?:talk\s+to\s+(?:the\s+)?parish\s+office|makausap\s+ang\s+parish\s+office|contact\s+(?:the\s+)?parish\s+office|kausapin\s+ang\s+(?:parish\s+)?office)/i.test(
          lastUserText
        )
      ) {
        let category = 'general';
        if (/baptism|binyag/i.test(lastUserText)) category = 'baptism';
        else if (/wedding|kasal/i.test(lastUserText)) category = 'wedding';
        else if (/funeral|libing/i.test(lastUserText)) category = 'funeral';
        else if (/certificate|katibayan/i.test(lastUserText)) category = 'certificate';
        else if (/intention|misa/i.test(lastUserText)) category = 'mass_intention';

        const replyText =
          "I've drafted a ticket for the parish office. You can review, edit the category, subject, or message, and confirm below:";
        const jsonBlock = `\n\`\`\`json\n{\n  "intent": {\n    "type": "draft_ticket",\n    "category": "${category}",\n    "subject": "Inquiry regarding parish services",\n    "message": "Hello, I would like to inquire about parish services."\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.02 Handoff: Cancel or reschedule appointment
      if (
        /(?:cancel|reschedule|move|postpone)\s+(?:my\s+)?(?:wedding|baptism|funeral|confirmation|blessing|appointment|booking)/i.test(
          lastUserText
        )
      ) {
        const replyText =
          "To cancel or reschedule an existing appointment, please view your appointment details or reach out directly to the parish office. The assistant cannot cancel or modify bookings on your behalf.";
        const jsonBlock = `\n\`\`\`json\n{\n  "handoff": {\n    "type": "appointment",\n    "label": "View Appointment",\n    "url": "/appointments"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.03 Handoff: Message Father / priest / staff
      if (
        /(?:message|chat\s+with|send\s+message\s+to)\s+(?:father|fr\.?|priest|padre|staff)/i.test(
          lastUserText
        )
      ) {
        const replyText =
          "You can send direct messages to parish clergy and ministry leaders from the Messages center. The assistant cannot send direct messages for you.";
        const jsonBlock = `\n\`\`\`json\n{\n  "handoff": {\n    "type": "messages",\n    "label": "Go to Messages",\n    "url": "/messages"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.1 Intent: Change Step ("Change the date", "Palitan ang petsa", etc.)
      if (
        /(?:change\s+(?:the\s+)?(?:date|time|service|priest)|palitan\s+ang\s+(?:petsa|oras|sakramento|pari)|iba(?:ng)?\s+(?:petsa|oras))/i.test(
          lastUserText
        )
      ) {
        let targetStep = 'date';
        if (/time|oras/i.test(lastUserText)) targetStep = 'time';
        else if (/service|sakramento/i.test(lastUserText)) targetStep = 'service';
        else if (/priest|pari/i.test(lastUserText)) targetStep = 'priest';

        const isTagalog = /palitan\s+ang|po\b|opo\b|sige/i.test(lastUserText);
        const isTaglish = /palitan.*date|change.*petsa/i.test(lastUserText);
        let replyText = `Sure, let's change the ${targetStep}. Please choose from the options below:`;
        if (isTagalog) {
          replyText = `Sige po, palitan natin ang ${targetStep === 'date' ? 'petsa' : (targetStep === 'time' ? 'oras' : targetStep)}. Mamili po muli sa ibaba:`;
        } else if (isTaglish) {
          replyText = `Opo, palitan po natin ang ${targetStep}. Pakipili po muli sa mga options sa ibaba:`;
        }

        const jsonBlock = `\n\`\`\`json\n{\n  "intent": {\n    "type": "change_step",\n    "step": "${targetStep}"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.2 Intent: Start Booking ("I want to book a baptism", "Gusto kong magpa-binyag", etc.)
      if (
        /(?:i\s+want\s+to\s+book|mag[-\s]?book\s+ng|magpa-?binyag|magpa-?kasal|gusto\s+ko(?:ng)?\s+mag[-\s]?book|gusto\s+ko(?:ng)?\s+magpa-?binyag|book\s+a\s+baptism|mag[-\s]?book)/i.test(
          lastUserText
        )
      ) {
        let serviceName = 'Baptism';
        if (/wedding|kasal/i.test(lastUserText)) serviceName = 'Wedding';
        else if (/confirmation|kumpil/i.test(lastUserText)) serviceName = 'Confirmation';
        else if (/blessing|bendisyon/i.test(lastUserText)) serviceName = 'Blessing';
        else if (/funeral|libing/i.test(lastUserText)) serviceName = 'Funeral';

        const isTagalog = /gusto\s+kong|magpa-?binyag|sa\s+parokya|po\b|opo\b|nais\s+ko/i.test(lastUserText);
        const isTaglish = /gusto\s+ko\s+mag[-\s]?book|pwede\s+ba\s+mag[-\s]?book|paki|please/i.test(lastUserText);

        let replyText = `Certainly! I would be pleased to assist you with booking a ${serviceName}. Please select an appointment date from the options below:`;
        if (isTagalog) {
          replyText = `Ikinagagalak ko po kayong tulungan sa pag-book ng ${serviceName}. Mamili po ng nais ninyong petsa sa mga opsyon sa ibaba:`;
        } else if (isTaglish) {
          replyText = `Opo, tutulungan ko po kayo mag-book ng ${serviceName}. Pakipili po ang petsa sa mga options sa ibaba:`;
        }

        const jsonBlock = `\n\`\`\`json\n{\n  "intent": {\n    "type": "start_booking",\n    "serviceName": "${serviceName}"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.3 Proposal: Time slot proposal (e.g. "10:00 AM", "2:00 PM", "10:00", "14:00")
      const timeMatch = lastUserText.match(/\b(10:00|14:00|2:00|02:00|10\s*am|2\s*pm|10am|2pm|11:00|09:00|alas\s+dyes|alas\s+dos)\b/i);
      if (currentBookingStep === 'time' || (timeMatch && currentBookingStep !== 'service' && currentBookingStep !== null)) {
        let proposedTime = '10:00';
        let displayTime = '10:00 AM';
        if (/2:00|02:00|14:00|2\s*pm|2pm|alas\s+dos/i.test(lastUserText)) {
          proposedTime = '14:00';
          displayTime = '2:00 PM';
        } else if (/11:00|11\s*am/i.test(lastUserText)) {
          proposedTime = '11:00';
          displayTime = '11:00 AM';
        } else if (/09:00|9:00|9\s*am/i.test(lastUserText)) {
          proposedTime = '09:00';
          displayTime = '9:00 AM';
        }

        const replyText = `I've noted your preferred time of ${displayTime}.`;
        const jsonBlock = `\n\`\`\`json\n{\n  "bookingProposal": {\n    "field": "time",\n    "value": "${proposedTime}"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // 0.4 Proposal: Date slot proposal (e.g. "next Saturday", "tomorrow", "YYYY-MM-DD")
      const isoDateMatch = lastUserText.match(/\b\d{4}-\d{2}-\d{2}\b/);
      const isDateProposal = isoDateMatch || /(?:tomorrow|next\s+saturday|sabado|bukas)/i.test(lastUserText);
      if (currentBookingStep === 'date' || (isDateProposal && currentBookingStep !== null)) {
        let proposedDate = '';
        const now = new Date();
        if (isoDateMatch) {
          proposedDate = isoDateMatch[0];
        } else if (/tomorrow|bukas/i.test(lastUserText)) {
          const d = new Date(now);
          d.setDate(d.getDate() + 1);
          proposedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else {
          // Next Saturday
          const d = new Date(now);
          const day = d.getDay();
          const diff = (6 - day + 7) % 7 || 7;
          d.setDate(d.getDate() + diff);
          proposedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const replyText = `I've noted your preferred date of ${proposedDate}.`;
        const jsonBlock = `\n\`\`\`json\n{\n  "bookingProposal": {\n    "field": "date",\n    "value": "${proposedDate}"\n  }\n}\n\`\`\``;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [{ text: replyText + jsonBlock }],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // A. "my appointments" inquiry
      const isAppointmentsQuery =
        /my\s+ap+ointments/i.test(lastUserText) ||
        (/ap+ointment/i.test(lastUserText) && /my|mine|status|ko/i.test(lastUserText)) ||
        /what\s+are\s+my\s+ap+ointments/i.test(lastUserText) ||
        /(?:mga\s+)?ap+ointment(?:s)?\s+ko\b/i.test(lastUserText) ||
        /(?:ano|kailan)\s+(?:po\s+)?(?:ang\s+)?(?:mga\s+)?ap+ointment/i.test(lastUserText);

      if (isAppointmentsQuery) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_my_appointments',
                        args: {},
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // B. Priest availability inquiry
      const isPriestAvailabilityQuery =
        /(?:father|fr\.?|priest|padre)/i.test(lastUserText) &&
        /(?:available|availability|free|pwede)/i.test(lastUserText);

      if (isPriestAvailabilityQuery) {
        const priestMatch = lastUserText.match(
          /(?:father|fr\.?|padre)\s+([a-zA-Z0-9\s]+?)(?:\s+available|\s+on|\s+at|\?|$)/i
        );
        const priestName = priestMatch ? priestMatch[1].trim() : 'Father';

        const dateMatch = lastUserText.match(/\b\d{4}-\d{2}-\d{2}\b/);
        const dayMatch = lastUserText.match(
          /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
        );
        const date = dateMatch ? dateMatch[0] : (dayMatch ? dayMatch[0] : 'Saturday');

        const timeMatch = lastUserText.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
        const time = timeMatch ? timeMatch[0] : undefined;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'check_priest_availability',
                        args: {
                          priest_name: priestName,
                          date,
                          time,
                          church_id: churchId || undefined,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // C. Mass across parishes inquiry
      const isMassAcrossParishesQuery =
        /(?:across\s+parishes|where\s+can\s+I\s+(?:hear|attend|find)\s+mass|all\s+parishes|ibang\s+parokya)/i.test(
          lastUserText
        );

      if (isMassAcrossParishesQuery) {
        const dayMatch = lastUserText.match(
          /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
        );
        const dayOfWeek = dayMatch ? dayMatch[0] : 'Sunday';
        const timeMatch = lastUserText.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
        const time = timeMatch ? timeMatch[0] : undefined;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'find_mass_across_parishes',
                        args: {
                          day_of_week: dayOfWeek,
                          time,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // D. Bookable services inquiry
      const isBookableServicesQuery =
        /(?:bookable\s+services|services\s+(?:offered|available|bookable)|what\s+services|mga\s+sakramento)/i.test(
          lastUserText
        );

      if (isBookableServicesQuery) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_bookable_services',
                        args: {
                          church_id: churchId,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // E. Sacrament requirements inquiry
      const isRequirementsQuery =
        /(?:requirement|requirements|checklist|documents|kailangan)\s+(?:for|needed|sa|para\s+sa)?/i.test(lastUserText) ||
        /(?:baptism|wedding|confirmation|funeral|kumpil|kasal|binyag|libing)\s+(?:requirement|documents|kailangan)/i.test(
          lastUserText
        );

      if (isRequirementsQuery) {
        let serviceName = 'Baptism';
        if (/wedding|kasal/i.test(lastUserText)) serviceName = 'Wedding';
        else if (/confirmation|kumpil/i.test(lastUserText)) serviceName = 'Confirmation';
        else if (/funeral|libing/i.test(lastUserText)) serviceName = 'Funeral';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_sacrament_requirements',
                        args: {
                          church_id: churchId,
                          service_name: serviceName,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // F. Free-text church knowledge inquiry
      const isKnowledgeQuery =
        /(?:ministry|ministries|history|office\s+hours|announcement|facility|facilities|oras\s+ng\s+opisina)/i.test(
          lastUserText
        );

      if (isKnowledgeQuery && churchId) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'search_church_knowledge',
                        args: {
                          church_id: churchId,
                          query: lastUserText,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // G. Standard Mass times inquiry for current church
      const isMassQuery =
        /mass/i.test(lastUserText) ||
        /schedule/i.test(lastUserText) ||
        /misa/i.test(lastUserText) ||
        /simba/i.test(lastUserText) ||
        /oras/i.test(lastUserText);

      if (isMassQuery) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'get_mass_schedule',
                        args: {
                          church_id: churchId,
                        },
                      },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })
        );
      }

      // Default conversational response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: 'Hello! I am your Sacralink Parish Assistant. How can I assist you with parish schedules or sacrament bookings today?',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        })
      );
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[fake-gemini] Server listening on http://0.0.0.0:${PORT}`);
});
