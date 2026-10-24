import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, ChevronDown, Church, MessageSquare, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getUserFavoriteChurchIds } from '../../lib/supabase/churchFavorites';
import { askParishAssistant } from '../../lib/supabase/parishAssistant';
import { getBookableServiceTypes, type ServiceType } from '../../lib/supabase/serviceTypes';
import { getRequirementsForService } from '../../lib/supabase/requirements';
import { getParishClergy, type ParishClergyMember } from '../../lib/supabase/priestAvailability';
import { celebrantLabel } from '../../hooks/useParishClergy';
import {
    type BookingDraft,
    type BookingStep,
    getStoredBookingDraft,
    saveStoredBookingDraft,
    clearStoredBookingDraft,
    getFutureDateCandidates,
    getOpenTimeSlots,
    evaluateRequestedPriest,
    submitConfirmedBooking,
    rewindBookingDraft,
    validateProposedDate,
    validateProposedTime,
} from '../../lib/bookingGuide';
import BookingSummaryCard from './BookingSummaryCard';
import DocumentUploadCards from './DocumentUploadCards';
import type { Database } from '../../types/database';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import chatbotIcon from '../../assets/chatbotIcon.png';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChurchOption {
    id: string;
    name: string;
}

const STARTER_CHIPS = [
    'What are the Mass schedules?',
    'Book a sacrament',
    'My appointments',
    'Talk to the parish office',
];

export default function ParishAssistant() {
    const { profile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState<boolean>(() => {
        try {
            return sessionStorage.getItem('sacralink:assistant-open') === 'true';
        } catch {
            return false;
        }
    });

    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [churches, setChurches] = useState<ChurchOption[]>([]);
    const [activeChurchId, setActiveChurchId] = useState<string | null>(null);
    const [showChurchPicker, setShowChurchPicker] = useState(false);
    const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
    const [pendingBookingStart, setPendingBookingStart] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Booking Guide State
    const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
    const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
    const [bookingSuccessAppointmentId, setBookingSuccessAppointmentId] = useState<string | null>(null);
    const isSubmittingRef = useRef(false);

    // Client-side Documents State (in browser memory only)
    const [attachedDocuments, setAttachedDocuments] = useState<Map<string, File>>(new Map());
    const [serviceRequirements, setServiceRequirements] = useState<SacramentRequirement[]>([]);
    const [loadingRequirements, setLoadingRequirements] = useState(false);

    // Dynamic Live Chips State
    const [servicesList, setServicesList] = useState<ServiceType[]>([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [openTimeSlots, setOpenTimeSlotsList] = useState<Array<{ time: string; label: string }>>([]);
    const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
    const [clergyList, setClergyList] = useState<ParishClergyMember[]>([]);
    const [loadingClergy, setLoadingClergy] = useState(false);

    // Track open state in sessionStorage
    useEffect(() => {
        try {
            sessionStorage.setItem('sacralink:assistant-open', isOpen ? 'true' : 'false');
        } catch {
            // ignore
        }
    }, [isOpen]);

    // 1. Fetch available active churches
    useEffect(() => {
        let isCancelled = false;
        async function loadChurches() {
            try {
                const { data } = await supabase
                    .from('churches')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('name');
                if (!isCancelled && data) {
                    setChurches(data);
                }
            } catch (err) {
                console.error('Failed to load churches for assistant:', err);
            }
        }
        void loadChurches();
        return () => {
            isCancelled = true;
        };
    }, []);

    // 2. Determine active parish:
    // - On `/churches/:id`, use that parish
    // - Elsewhere, use favourite parish, or prompt with chips
    useEffect(() => {
        const churchMatch = location.pathname.match(/\/churches\/([0-9a-fA-F-]+)/);
        const routeChurchId = churchMatch ? churchMatch[1] : null;

        if (routeChurchId) {
            setActiveChurchId(routeChurchId);
            return;
        }

        if (!activeChurchId && profile?.id) {
            let isCancelled = false;
            async function resolveDefaultParish() {
                try {
                    const localSaved = localStorage.getItem('selectedChurchId');
                    if (localSaved) {
                        setActiveChurchId(localSaved);
                        return;
                    }
                    const favorites = await getUserFavoriteChurchIds(profile!.id);
                    if (isCancelled) return;
                    if (favorites.length > 0) {
                        setActiveChurchId(favorites[0]);
                    } else if (profile?.church_id) {
                        setActiveChurchId(profile.church_id);
                    }
                } catch (err) {
                    console.error('Error resolving favourite parish:', err);
                }
            }
            void resolveDefaultParish();
            return () => {
                isCancelled = true;
            };
        }
    }, [location.pathname, profile, activeChurchId]);

    const activeChurch = churches.find((c) => c.id === activeChurchId);

    // 3. Restore booking draft from sessionStorage on mount
    useEffect(() => {
        const stored = getStoredBookingDraft();
        if (stored && stored.step !== 'confirmed') {
            setBookingDraft(stored);
            if (stored.churchId && !activeChurchId) {
                setActiveChurchId(stored.churchId);
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen, bookingDraft?.step]);

    // Load services when at 'service' step
    useEffect(() => {
        const targetChurchId = bookingDraft?.churchId || activeChurchId;
        if (bookingDraft?.step === 'service' && targetChurchId) {
            let cancelled = false;
            setLoadingServices(true);
            void getBookableServiceTypes(targetChurchId).then((services) => {
                if (!cancelled) {
                    setServicesList(services);
                    setLoadingServices(false);
                }
            }).catch(() => {
                if (!cancelled) setLoadingServices(false);
            });
            return () => {
                cancelled = true;
            };
        }
    }, [bookingDraft?.step, bookingDraft?.churchId, activeChurchId]);

    // Load available time slots when at 'time' step
    useEffect(() => {
        if (bookingDraft?.step === 'time' && bookingDraft.churchId && bookingDraft.date) {
            let cancelled = false;
            setLoadingTimeSlots(true);
            void getOpenTimeSlots(bookingDraft.churchId, bookingDraft.date).then((slots) => {
                if (!cancelled) {
                    setOpenTimeSlotsList(slots);
                    setLoadingTimeSlots(false);
                }
            }).catch(() => {
                if (!cancelled) setLoadingTimeSlots(false);
            });
            return () => {
                cancelled = true;
            };
        }
    }, [bookingDraft?.step, bookingDraft?.churchId, bookingDraft?.date]);

    // Load parish clergy when at 'priest' step
    useEffect(() => {
        if (bookingDraft?.step === 'priest' && bookingDraft.churchId) {
            let cancelled = false;
            setLoadingClergy(true);
            void getParishClergy(bookingDraft.churchId).then(({ data }) => {
                if (!cancelled) {
                    setClergyList(data);
                    setLoadingClergy(false);
                }
            }).catch(() => {
                if (!cancelled) setLoadingClergy(false);
            });
            return () => {
                cancelled = true;
            };
        }
    }, [bookingDraft?.step, bookingDraft?.churchId]);

    // Load sacrament requirements whenever serviceTypeId is selected
    useEffect(() => {
        const serviceTypeId = bookingDraft?.serviceTypeId;
        if (serviceTypeId) {
            let cancelled = false;
            setLoadingRequirements(true);
            void getRequirementsForService(serviceTypeId)
                .then((reqs) => {
                    if (!cancelled) {
                        setServiceRequirements(reqs || []);
                        setLoadingRequirements(false);
                    }
                })
                .catch((err) => {
                    console.error('Failed to load service requirements:', err);
                    if (!cancelled) {
                        setServiceRequirements([]);
                        setLoadingRequirements(false);
                    }
                });
            return () => {
                cancelled = true;
            };
        } else {
            setServiceRequirements([]);
        }
    }, [bookingDraft?.serviceTypeId]);

    // Candidate future dates (next 7 future days, strictly no past dates)
    const futureDateCandidates = useMemo(() => getFutureDateCandidates(7), []);

    // Booking Guide: Start flow
    const startBookingGuide = useCallback((overrideChurchId?: string) => {
        let targetChurchId = overrideChurchId ?? activeChurchId;
        if (!targetChurchId) {
            const localSaved = localStorage.getItem('selectedChurchId');
            if (localSaved && churches.some((c) => c.id === localSaved)) {
                targetChurchId = localSaved;
                setActiveChurchId(localSaved);
            }
        }
        if (!targetChurchId && churches.length > 0) {
            setMessages((prev) => [
                ...prev,
                { id: `user-${Date.now()}`, role: 'user', content: 'Book a sacrament' },
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: 'Which parish would you like to book with? Please select from the churches below:',
                },
            ]);
            setPendingBookingStart(true);
            return;
        }

        const churchRecord = churches.find((c) => c.id === targetChurchId);
        const churchDisplayName = churchRecord?.name || activeChurch?.name || 'the parish';

        const newDraft: BookingDraft = {
            churchId: targetChurchId!,
            churchName: churchDisplayName,
            step: 'service',
        };
        setBookingDraft(newDraft);
        saveStoredBookingDraft(newDraft);
        setBookingSuccessAppointmentId(null);

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: 'Book a sacrament' },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Which sacrament or service would you like to book at ${churchDisplayName}?`,
            },
        ]);
    }, [activeChurchId, activeChurch?.name, churches]);

    // Booking Guide Step 1: Select Service
    const handleSelectService = (service: ServiceType) => {
        if (!bookingDraft) return;
        setAttachedDocuments(new Map());
        const updated: BookingDraft = {
            ...bookingDraft,
            serviceTypeId: service.id,
            serviceTypeName: service.name,
            serviceKind: service.kind,
            step: 'date',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: service.name },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Please select an appointment date for ${service.name}:`,
            },
        ]);
    };

    // Booking Guide Step 2: Select Date
    const handleSelectDate = (dateStr: string, dateLabel: string) => {
        if (!bookingDraft) return;
        const updated: BookingDraft = {
            ...bookingDraft,
            date: dateStr,
            formattedDate: dateLabel,
            step: 'time',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: dateLabel },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Please select an available time slot for ${dateLabel}:`,
            },
        ]);
    };

    // Booking Guide Step 3: Select Time
    const handleSelectTime = (timeStr: string, timeLabel: string) => {
        if (!bookingDraft) return;
        const updated: BookingDraft = {
            ...bookingDraft,
            time: timeStr,
            formattedTime: timeLabel,
            step: 'priest',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: timeLabel },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: 'Do you have a preferred priest to request, or would you like any available priest?',
            },
        ]);
    };

    // Booking Guide Step 4: Select Priest (or Any)
    const handleSelectPriest = async (priestId: string | null, priestLabel: string) => {
        if (!bookingDraft) return;

        let warning: string | undefined;
        if (priestId && bookingDraft.churchId && bookingDraft.date && bookingDraft.time) {
            const check = await evaluateRequestedPriest(
                bookingDraft.churchId,
                priestId,
                bookingDraft.date,
                bookingDraft.time,
                priestLabel
            );
            if (!check.eligible && check.warning) {
                warning = check.warning;
            }
        }

        // Determine if requirements exist for this service
        let reqs = serviceRequirements;
        if (reqs.length === 0 && bookingDraft.serviceTypeId) {
            try {
                reqs = await getRequirementsForService(bookingDraft.serviceTypeId);
                setServiceRequirements(reqs || []);
            } catch {
                reqs = [];
            }
        }

        const hasReqs = reqs.length > 0;
        const nextStep: BookingStep = hasReqs ? 'documents' : 'notes';

        const updated: BookingDraft = {
            ...bookingDraft,
            requestedPriestId: priestId || null,
            requestedPriestName: priestLabel,
            priestWarning: warning || null,
            hasRequirements: hasReqs,
            step: nextStep,
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        const newMessages: Message[] = [
            ...messages,
            { id: `user-${Date.now()}`, role: 'user', content: priestLabel },
        ];

        if (warning) {
            newMessages.push({
                id: `assistant-warn-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ ${warning}`,
            });
        }

        if (hasReqs) {
            newMessages.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `${bookingDraft.serviceTypeName || 'This service'} requires supporting documents. Please attach the required documents below:`,
            });
        } else {
            newMessages.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: 'Would you like to add any notes or special intentions for the parish office? (Optional)',
            });
        }

        setMessages(newMessages);
    };

    // Booking Guide Step 4.5: Document Upload Handlers
    const handleFileSelect = (reqId: string, file: File) => {
        setAttachedDocuments((prev) => {
            const next = new Map(prev);
            next.set(reqId, file);
            return next;
        });
    };

    const handleFileRemove = (reqId: string) => {
        setAttachedDocuments((prev) => {
            const next = new Map(prev);
            next.delete(reqId);
            return next;
        });
    };

    const handleContinueFromDocuments = () => {
        if (!bookingDraft) return;
        const updated: BookingDraft = {
            ...bookingDraft,
            step: 'notes',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        const count = attachedDocuments.size;
        const userContent = count > 0
            ? `${count} document${count > 1 ? 's' : ''} attached`
            : 'Proceed to notes';

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: userContent },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: 'Would you like to add any notes or special intentions for the parish office? (Optional)',
            },
        ]);
    };

    const handleGoToDocuments = () => {
        if (!bookingDraft) return;
        const updated: BookingDraft = {
            ...bookingDraft,
            step: 'documents',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);
    };

    // Booking Guide Step 5: Notes / Skip
    const handleNotesInput = useCallback((notesText: string) => {
        if (!bookingDraft) return;
        const trimmed = notesText.trim();
        const updated: BookingDraft = {
            ...bookingDraft,
            notes: trimmed || undefined,
            step: 'summary',
        };
        setBookingDraft(updated);
        saveStoredBookingDraft(updated);

        setMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, role: 'user', content: trimmed ? trimmed : 'No notes / Skip' },
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: 'Here is your booking summary. Please review the details below and tap Confirm Booking to submit:',
            },
        ]);
    }, [bookingDraft]);

    // Booking Guide Step 6: Confirm Booking
    const handleConfirmBooking = async () => {
        if (!bookingDraft || !profile?.id) return;
        if (isSubmittingRef.current || isBookingSubmitting) return;

        isSubmittingRef.current = true;
        setIsBookingSubmitting(true);

        try {
            const result = await submitConfirmedBooking({
                draft: bookingDraft,
                userId: profile.id,
                userName: profile.full_name || 'A parishioner',
                documents: attachedDocuments,
                requirements: serviceRequirements,
            });

            if (result.success && result.appointmentId) {
                setBookingSuccessAppointmentId(result.appointmentId);
                const confirmedDraft = { ...bookingDraft, step: 'confirmed' as const };
                setBookingDraft(confirmedDraft);
                setAttachedDocuments(new Map());
                clearStoredBookingDraft();

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-success-${Date.now()}`,
                        role: 'assistant',
                        content: `### Booking Request Submitted!\nYour appointment request for **${bookingDraft.serviceTypeName}** on **${bookingDraft.formattedDate}** at **${bookingDraft.formattedTime}** has been submitted as **Pending**.\n\nThe parish office administrators have been notified to review and assign a celebrant.`,
                    },
                ]);
            } else {
                const errorMsg = typeof result.error === 'string'
                    ? result.error
                    : (result.error && typeof result.error === 'object' && 'message' in (result.error as { message?: string })
                        ? String((result.error as { message?: string }).message)
                        : 'The selected slot could not be booked. Please select an alternative slot or change the date and time.');
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-fail-${Date.now()}`,
                        role: 'assistant',
                        content: `⚠️ ${errorMsg}`,
                    },
                ]);
            }
        } catch (err: unknown) {
            console.error('Error submitting booking:', err);
            setMessages((prev) => [
                ...prev,
                {
                    id: `assistant-fail-${Date.now()}`,
                    role: 'assistant',
                    content: 'An unexpected error occurred while confirming your booking. Please try again.',
                },
            ]);
        } finally {
            setIsBookingSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    // Booking Guide: Change details
    const handleChangeBooking = () => {
        if (!bookingDraft) return;
        setAttachedDocuments(new Map());
        const resetDraft: BookingDraft = {
            ...bookingDraft,
            step: 'service',
        };
        setBookingDraft(resetDraft);
        saveStoredBookingDraft(resetDraft);
        setBookingSuccessAppointmentId(null);

        setMessages((prev) => [
            ...prev,
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Let's modify your booking. Which sacrament or service would you like to book?`,
            },
        ]);
    };

    // Booking Guide: Cancel
    const handleCancelBooking = useCallback(() => {
        setBookingDraft(null);
        setAttachedDocuments(new Map());
        clearStoredBookingDraft();
        setBookingSuccessAppointmentId(null);
        setMessages((prev) => [
            ...prev,
            {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: 'Sacrament booking has been cancelled. How else can I help you today?',
            },
        ]);
    }, []);

    // Main Chat Message Handler
    const handleSendMessage = useCallback(
        async (questionText: string, overrideChurchId?: string) => {
            const trimmed = questionText.trim();
            if (!trimmed || isLoading || isBookingSubmitting) return;

            // If user explicitly asks to cancel mid-booking
            if (bookingDraft && /^(?:cancel|stop|quit)$/i.test(trimmed)) {
                handleCancelBooking();
                return;
            }

            // If user taps or asks to book a sacrament without naming one
            if (/^(?:book\s+a?\s*sacrament|mag-book\s+ng\s*sakramento|schedule\s+appointment)$/i.test(trimmed)) {
                startBookingGuide(overrideChurchId);
                return;
            }

            const targetChurchId = overrideChurchId ?? activeChurchId;

            // If question is parish-specific and no parish is selected yet, prompt with parish chips
            const isAcrossParishes = /across\s+parishes|all\s+parishes|every\s+parish|diocesan/i.test(trimmed);
            const isParishQuestion =
                !isAcrossParishes &&
                /mass|schedule|misa|sacrament|bautismo|kumpil|wedding|kasal/i.test(trimmed);
            if (!targetChurchId && isParishQuestion && churches.length > 0) {
                setMessages((prev) => [
                    ...prev,
                    { id: `user-${Date.now()}`, role: 'user', content: trimmed },
                    {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content:
                            'Which parish would you like to inquire about? Please select from the churches below:',
                    },
                ]);
                setPendingQuestion(trimmed);
                return;
            }

            const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: trimmed };
            setMessages((prev) => [...prev, userMsg]);
            setIsLoading(true);
            setPendingQuestion(null);

            try {
                const historyPayload = messages.slice(-6).map((m) => ({
                    role: m.role,
                    content: m.content,
                }));

                const draftPayload = bookingDraft
                    ? {
                        currentStep: bookingDraft.step,
                        serviceTypeId: bookingDraft.serviceTypeId,
                        serviceTypeName: bookingDraft.serviceTypeName,
                        appointmentDate: bookingDraft.date,
                        appointmentTime: bookingDraft.time,
                        requestedPriestId: bookingDraft.requestedPriestId,
                        requestedPriestName: bookingDraft.requestedPriestName,
                        notes: bookingDraft.notes,
                    }
                    : null;

                const result = await askParishAssistant({
                    message: trimmed,
                    churchId: targetChurchId,
                    churchName: activeChurch?.name,
                    conversationHistory: historyPayload,
                    bookingDraft: draftPayload,
                });

                // 1. Add assistant reply to message history
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: result.reply,
                    },
                ]);

                // 2. Handle intent if returned
                if (result.intent) {
                    if (result.intent.type === 'start_booking') {
                        const requestedService = result.intent.serviceName || 'Baptism';
                        let services = servicesList;
                        if (services.length === 0 && targetChurchId) {
                            try {
                                services = await getBookableServiceTypes(targetChurchId);
                                setServicesList(services);
                            } catch (err) {
                                console.warn('Could not fetch services for intent:', err);
                            }
                        }
                        const matched = services.find((s) =>
                            s.name.toLowerCase().includes(requestedService.toLowerCase())
                        );

                        const churchRecord = churches.find((c) => c.id === targetChurchId);
                        const churchDisplayName = churchRecord?.name || activeChurch?.name || 'the parish';

                        if (matched) {
                            setAttachedDocuments(new Map());
                            const newDraft: BookingDraft = {
                                churchId: targetChurchId!,
                                churchName: churchDisplayName,
                                serviceTypeId: matched.id,
                                serviceTypeName: matched.name,
                                serviceKind: matched.kind,
                                step: 'date',
                            };
                            setBookingDraft(newDraft);
                            saveStoredBookingDraft(newDraft);
                            setBookingSuccessAppointmentId(null);
                        } else {
                            startBookingGuide(targetChurchId || undefined);
                        }
                    } else if (result.intent.type === 'change_step' && bookingDraft) {
                        const targetStep = result.intent.step as BookingStep;
                        const rewound = rewindBookingDraft(bookingDraft, targetStep);
                        setBookingDraft(rewound);
                        saveStoredBookingDraft(rewound);
                        if (targetStep === 'date' || targetStep === 'service') {
                            setAttachedDocuments(new Map());
                        }
                    } else if (result.intent.type === 'cancel_booking') {
                        handleCancelBooking();
                    }
                }

                // 3. Handle booking proposal if returned
                if (result.bookingProposal && bookingDraft) {
                    const proposal = result.bookingProposal;
                    if (proposal.field === 'date' && bookingDraft.churchId) {
                        const validation = await validateProposedDate(bookingDraft.churchId, proposal.value);
                        if (validation.valid) {
                            const updated: BookingDraft = {
                                ...bookingDraft,
                                date: proposal.value,
                                formattedDate: validation.formattedDate || proposal.value,
                                step: 'time',
                            };
                            setBookingDraft(updated);
                            saveStoredBookingDraft(updated);
                        } else {
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id: `assistant-proposal-err-${Date.now()}`,
                                    role: 'assistant',
                                    content: `⚠️ ${validation.error || 'The proposed date is unavailable. Please select from the dates below:'}`,
                                },
                            ]);
                        }
                    } else if (proposal.field === 'time' && bookingDraft.churchId && bookingDraft.date) {
                        const validation = await validateProposedTime(
                            bookingDraft.churchId,
                            bookingDraft.date,
                            proposal.value
                        );
                        if (validation.valid && validation.normalizedTime) {
                            const updated: BookingDraft = {
                                ...bookingDraft,
                                time: validation.normalizedTime,
                                formattedTime: validation.formattedTime || validation.normalizedTime,
                                step: 'priest',
                            };
                            setBookingDraft(updated);
                            saveStoredBookingDraft(updated);
                        } else {
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id: `assistant-proposal-err-${Date.now()}`,
                                    role: 'assistant',
                                    content: `⚠️ ${validation.error || 'The proposed time is unavailable. Please select from the available time slots below:'}`,
                                },
                            ]);
                        }
                    } else if (proposal.field === 'notes') {
                        const updated: BookingDraft = {
                            ...bookingDraft,
                            notes: proposal.value.trim() || undefined,
                            step: 'summary',
                        };
                        setBookingDraft(updated);
                        saveStoredBookingDraft(updated);
                    }
                } else if (
                    bookingDraft &&
                    bookingDraft.step === 'notes' &&
                    !result.intent &&
                    !trimmed.includes('?') &&
                    !/^\s*(?:what|when|where|who|how|kailan|saan|ano|bakit|pwede|can|is|are)\b/i.test(trimmed)
                ) {
                    // Direct notes typing when in notes step
                    const updated: BookingDraft = {
                        ...bookingDraft,
                        notes: trimmed,
                        step: 'summary',
                    };
                    setBookingDraft(updated);
                    saveStoredBookingDraft(updated);
                }
            } catch (err: unknown) {
                console.error('Error invoking parish assistant:', err);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-err-${Date.now()}`,
                        role: 'assistant',
                        content:
                            "I'm having trouble connecting to the parish assistant service. Please check your connection or contact the parish office directly.",
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        },
        [
            activeChurchId,
            activeChurch?.name,
            bookingDraft,
            churches,
            handleCancelBooking,
            isBookingSubmitting,
            isLoading,
            messages,
            servicesList,
            startBookingGuide,
        ]
    );

    const handleSelectChurchFromChip = (church: ChurchOption) => {
        setActiveChurchId(church.id);
        setShowChurchPicker(false);
        if (pendingBookingStart) {
            setPendingBookingStart(false);
            startBookingGuide(church.id);
        } else if (pendingQuestion) {
            void handleSendMessage(pendingQuestion, church.id);
        }
    };

    // The assistant is strictly for Parishioners (role 'user').
    // Staff roles (church_admin, priest, volunteer, super_admin) never see it.
    if (profile?.role !== 'user') {
        return null;
    }

    return (
        <>
            {/* Floating Toggle Button */}
            {!isOpen && (
                <button
                    data-testid="parish-assistant-button"
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary hover:bg-primary-600 text-white px-4 py-3 rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-primary/20"
                    aria-label="Open AI Parish Assistant"
                >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-white/20 p-0.5 flex items-center justify-center">
                        <img src={chatbotIcon} alt="AI" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight pr-1">Parish Assistant</span>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </button>
            )}

            {/* Assistant Dialog Window */}
            {isOpen && (
                <div
                    data-testid="parish-assistant-panel"
                    className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[410px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-5rem)] flex flex-col bg-white border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
                >
                    {/* Header */}
                    <div className="bg-white border-b border-border px-4 py-3 flex items-center justify-between gap-2 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-200 bg-amber-50 p-0.5 flex-shrink-0">
                                <img
                                    src={chatbotIcon}
                                    alt="Parish Assistant"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-sm font-bold text-foreground truncate">
                                        Parish Assistant
                                    </h2>
                                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                        AI
                                    </span>
                                </div>

                                {/* Active Parish Chip & Selector */}
                                <div className="relative">
                                    <button
                                        data-testid="parish-assistant-church-chip"
                                        onClick={() => setShowChurchPicker(!showChurchPicker)}
                                        className="text-[11px] text-muted hover:text-foreground flex items-center gap-1 truncate font-medium hover:underline text-left"
                                        title="Switch parish"
                                    >
                                        <Church className="w-3 h-3 text-primary flex-shrink-0" />
                                        <span className="truncate max-w-[170px] sm:max-w-[200px]">
                                            {activeChurch?.name || 'Select Parish'}
                                        </span>
                                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                    </button>

                                    {/* Church Picker Dropdown */}
                                    {showChurchPicker && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowChurchPicker(false)}
                                            />
                                            <div className="absolute left-0 top-full mt-1.5 w-64 max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-xl py-1 z-20">
                                                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border">
                                                    Select Active Parish
                                                </div>
                                                {churches.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-muted">
                                                        No active parishes found
                                                    </div>
                                                ) : (
                                                    churches.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => handleSelectChurchFromChip(c)}
                                                            className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors ${
                                                                c.id === activeChurchId
                                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                                    : 'text-foreground hover:bg-secondary-50'
                                                            }`}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Close button */}
                        <button
                            data-testid="parish-assistant-close"
                            onClick={() => setIsOpen(false)}
                            className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-secondary-100 transition-colors"
                            aria-label="Close assistant"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Chat Messages Flow */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-background/50">
                        {/* Welcome card if empty */}
                        {messages.length === 0 && !bookingDraft && (
                            <div className="card bg-white border border-border rounded-2xl p-4 shadow-xs text-center space-y-2 mt-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    Peace be with you!
                                </h3>
                                <p className="text-xs text-muted leading-relaxed">
                                    I can help you check live Mass schedules, guide sacrament bookings, or connect with the parish office.
                                </p>
                            </div>
                        )}

                        {/* Render conversation turns */}
                        {messages.map((m) => (
                            <div key={m.id} data-testid={m.role === 'assistant' ? 'assistant-reply' : undefined}>
                                <ChatMessage role={m.role} content={m.content} />
                            </div>
                        ))}

                        {/* Parish Selection Chips if prompted */}
                        {(pendingQuestion || pendingBookingStart) && !activeChurchId && churches.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {churches.map((church) => (
                                    <button
                                        key={church.id}
                                        onClick={() => handleSelectChurchFromChip(church)}
                                        className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3 py-1.5 rounded-full border border-border shadow-xs transition-colors"
                                    >
                                        {church.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* Live Guided Booking Chips & Cards                            */}
                        {/* ============================================================ */}

                        {/* Step 1: Service Selection Chips */}
                        {bookingDraft?.step === 'service' && (
                            <div className="space-y-1.5 pt-1">
                                {loadingServices ? (
                                    <div className="flex items-center gap-2 text-xs text-muted py-2 pl-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                        <span>Loading available sacraments & services...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {servicesList.map((service) => (
                                            <button
                                                key={service.id}
                                                type="button"
                                                data-testid={`service-chip-${service.id}`}
                                                onClick={() => handleSelectService(service)}
                                                className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3.5 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                            >
                                                {service.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Date Selection Chips */}
                        {bookingDraft?.step === 'date' && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex flex-wrap gap-1.5">
                                    {futureDateCandidates.map((candidate) => (
                                        <button
                                            key={candidate.date}
                                            type="button"
                                            data-testid={`date-chip-${candidate.date}`}
                                            data-date={candidate.date}
                                            onClick={() => handleSelectDate(candidate.date, candidate.label)}
                                            className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3.5 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                        >
                                            {candidate.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Time Selection Chips */}
                        {bookingDraft?.step === 'time' && (
                            <div className="space-y-1.5 pt-1">
                                {loadingTimeSlots ? (
                                    <div className="flex items-center gap-2 text-xs text-muted py-2 pl-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                        <span>Checking available open slots...</span>
                                    </div>
                                ) : openTimeSlots.length === 0 ? (
                                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3 space-y-2">
                                        <p>No open time slots available on this date. Please choose an alternative date:</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const backToDate: BookingDraft = { ...bookingDraft, step: 'date' };
                                                setBookingDraft(backToDate);
                                                saveStoredBookingDraft(backToDate);
                                            }}
                                            className="text-xs bg-white border border-border px-3 py-1 rounded-lg text-foreground hover:bg-secondary-50 font-medium"
                                        >
                                            Change Date
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {openTimeSlots.map((slot) => (
                                            <button
                                                key={slot.time}
                                                type="button"
                                                data-testid={`time-chip-${slot.time.replace(':', '-')}`}
                                                data-time={slot.time}
                                                onClick={() => handleSelectTime(slot.time, slot.label)}
                                                className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3.5 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                            >
                                                {slot.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4: Priest Selection Chips */}
                        {bookingDraft?.step === 'priest' && (
                            <div className="space-y-1.5 pt-1">
                                {loadingClergy ? (
                                    <div className="flex items-center gap-2 text-xs text-muted py-2 pl-1">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                        <span>Consulting parish clergy roster...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            data-testid="priest-chip-any"
                                            onClick={() => void handleSelectPriest(null, 'Any available priest')}
                                            className="text-xs bg-secondary-100 hover:bg-primary hover:text-white text-secondary-900 font-semibold px-3.5 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                        >
                                            Any available priest
                                        </button>
                                        {clergyList.map((priest) => {
                                            const label = celebrantLabel(priest);
                                            return (
                                                <button
                                                    key={priest.priestId}
                                                    type="button"
                                                    data-testid={`priest-chip-${priest.priestId}`}
                                                    onClick={() => void handleSelectPriest(priest.priestId, label)}
                                                    className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3.5 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4.5: Document Upload Cards */}
                        {bookingDraft?.step === 'documents' && (
                            <DocumentUploadCards
                                requirements={serviceRequirements}
                                documents={attachedDocuments}
                                onFileSelect={handleFileSelect}
                                onFileRemove={handleFileRemove}
                                onContinue={handleContinueFromDocuments}
                                isLoading={loadingRequirements}
                            />
                        )}

                        {/* Step 5: Notes Selection / Skip Chip */}
                        {bookingDraft?.step === 'notes' && (
                            <div className="space-y-2 pt-1">
                                <p className="text-[11px] text-muted italic">
                                    Type your special intention below or tap skip:
                                </p>
                                <button
                                    type="button"
                                    data-testid="notes-chip-skip"
                                    onClick={() => handleNotesInput('')}
                                    className="text-xs bg-secondary-50 hover:bg-secondary-100 text-secondary-800 font-medium px-4 py-1.5 rounded-full border border-border shadow-xs transition-all active:scale-95"
                                >
                                    No notes / Skip
                                </button>
                            </div>
                        )}

                        {/* Step 6: Booking Summary Card */}
                        {bookingDraft?.step === 'summary' && (
                            <BookingSummaryCard
                                draft={bookingDraft}
                                requirements={serviceRequirements}
                                attachedDocuments={attachedDocuments}
                                isSubmitting={isBookingSubmitting}
                                onConfirm={() => void handleConfirmBooking()}
                                onChange={handleChangeBooking}
                                onCancel={handleCancelBooking}
                                onGoToDocuments={handleGoToDocuments}
                            />
                        )}

                        {/* Step 7: Confirmed Success Card */}
                        {bookingDraft?.step === 'confirmed' && (
                            <div
                                data-testid="booking-success-card"
                                className="card bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs space-y-2.5 my-2"
                            >
                                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Booking Confirmed</span>
                                </div>
                                <p className="text-xs text-emerald-700 leading-relaxed">
                                    Your request has been submitted to <strong>{bookingDraft.churchName}</strong> and is currently <strong>Pending Review</strong>.
                                </p>
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        data-testid="view-appointment-link"
                                        data-appointment-id={bookingSuccessAppointmentId || undefined}
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate('/appointments');
                                        }}
                                        className="inline-flex items-center gap-1.5 text-xs bg-primary hover:bg-primary-600 text-white font-medium px-3.5 py-1.5 rounded-xl shadow-xs transition-colors"
                                    >
                                        <span>View My Appointments</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Thinking / Loading indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted py-1 pl-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                <span>Consulting live parish records...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Starter Quick-Tap Chips (When not actively in a multi-step booking draft) */}
                    {(!bookingDraft || bookingDraft.step === 'confirmed') && (
                        <div className="px-3 pt-2 pb-1 bg-white border-t border-border/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {STARTER_CHIPS.map((chip) => (
                                <button
                                    key={chip}
                                    data-testid={`starter-chip-${chip.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                                    onClick={() => void handleSendMessage(chip)}
                                    disabled={isLoading || isBookingSubmitting}
                                    className="whitespace-nowrap text-xs bg-secondary-50 hover:bg-secondary-100 text-secondary-800 font-medium px-3 py-1.5 rounded-full border border-border transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Chat Input */}
                    <ChatInput
                        onSend={(txt) => void handleSendMessage(txt)}
                        disabled={isLoading || isBookingSubmitting}
                    />
                </div>
            )}
        </>
    );
}
