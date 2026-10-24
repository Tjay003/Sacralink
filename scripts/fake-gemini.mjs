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

  if (req.method === 'POST' && url.pathname.includes(':generateContent')) {
    let bodyText = '';
    for await (const chunk of req) {
      bodyText += chunk;
    }

    try {
      const body = JSON.parse(bodyText);
      const { contents = [], system_instruction } = body;

      // Extract church ID from system instruction if present
      const systemText = system_instruction?.parts?.[0]?.text || '';
      const matchChurch = systemText.match(/parish ID:\s*([a-f0-9-]+)/i);
      const churchId = matchChurch ? matchChurch[1] : '';

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
          let replyText = '';
          if (schedules.length === 0) {
            replyText = 'There are no scheduled Masses posted for this parish at the moment.';
          } else {
            const list = schedules
              .map(
                (s) =>
                  `• ${s.day_of_week} at ${s.time}${s.language ? ` (${s.language})` : ''}`
              )
              .join('\n');
            replyText = `Here is the current Mass schedule:\n${list}`;
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
          let replyText = '';
          if (appointments.length === 0) {
            replyText = 'You do not have any appointments scheduled at this moment.';
          } else {
            const list = appointments
              .map((a) => {
                let details = `• ${a.service_type} at ${a.church?.name || 'the parish'} on ${a.appointment_date} at ${a.appointment_time} (Status: ${a.status})`;
                if (a.notes) {
                  details += ` - Notes: ${a.notes}`;
                }
                if (a.rescheduled_from_date) {
                  details += ` [Rescheduled from ${a.rescheduled_from_date}${a.reschedule_reason ? `: ${a.reschedule_reason}` : ''}]`;
                }
                return details;
              })
              .join('\n');
            replyText = `Here are your scheduled appointments:\n${list}`;
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
          let replyText = '';
          if (requirements.length === 0) {
            replyText = 'There are no specific document requirements listed for this sacrament.';
          } else {
            const list = requirements
              .map(
                (r) =>
                  `• ${r.requirement_name}${r.is_required ? ' (Required)' : ' (Optional)'}${r.description ? `: ${r.description}` : ''}`
              )
              .join('\n');
            replyText = `Here are the requirements:\n${list}`;
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
      const userText = contents
        .filter((c) => c.role === 'user')
        .flatMap((c) => c.parts || [])
        .map((p) => p.text || '')
        .join(' ');

      // A. "my appointments" inquiry
      const isAppointmentsQuery =
        /my\s+appointments/i.test(userText) ||
        (/appointment/i.test(userText) && /my|mine|status/i.test(userText)) ||
        /what\s+are\s+my\s+appointments/i.test(userText);

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
        /(?:father|fr\.?|priest|padre)/i.test(userText) &&
        /(?:available|availability|free|pwede)/i.test(userText);

      if (isPriestAvailabilityQuery) {
        const priestMatch = userText.match(
          /(?:father|fr\.?|padre)\s+([a-zA-Z0-9\s]+?)(?:\s+available|\s+on|\s+at|\?|$)/i
        );
        const priestName = priestMatch ? priestMatch[1].trim() : 'Father';

        const dateMatch = userText.match(/\b\d{4}-\d{2}-\d{2}\b/);
        const dayMatch = userText.match(
          /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
        );
        const date = dateMatch ? dateMatch[0] : (dayMatch ? dayMatch[0] : 'Saturday');

        const timeMatch = userText.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
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
        /(?:across\s+parishes|where\s+can\s+I\s+(?:hear|attend|find)\s+mass|all\s+parishes)/i.test(
          userText
        );

      if (isMassAcrossParishesQuery) {
        const dayMatch = userText.match(
          /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
        );
        const dayOfWeek = dayMatch ? dayMatch[0] : 'Sunday';
        const timeMatch = userText.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
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
        /(?:bookable\s+services|services\s+(?:offered|available|bookable)|what\s+services)/i.test(
          userText
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
        /(?:requirement|requirements|checklist|documents)\s+(?:for|needed)?/i.test(userText) ||
        /(?:baptism|wedding|confirmation|kumpil|kasal|binyag)\s+(?:requirement|documents)/i.test(
          userText
        );

      if (isRequirementsQuery) {
        let serviceName = 'Baptism';
        if (/wedding|kasal/i.test(userText)) serviceName = 'Wedding';
        else if (/confirmation|kumpil/i.test(userText)) serviceName = 'Confirmation';
        else if (/funeral/i.test(userText)) serviceName = 'Funeral';

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
        /(?:ministry|ministries|history|office\s+hours|announcement|facility|facilities)/i.test(
          userText
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
                          query: userText,
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
        /mass/i.test(userText) ||
        /schedule/i.test(userText) ||
        /misa/i.test(userText) ||
        /oras/i.test(userText);

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
