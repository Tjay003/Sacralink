import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
    id: string;
    title: string;
    date: Date;
    time: string;
    location?: string;
    type: 'appointment' | 'event' | 'announcement';
    attendees?: number;
}

// Mock data - replace with real data later
const MOCK_EVENTS: Event[] = [
    {
        id: '1',
        title: 'Baptism Ceremony',
        date: new Date(2026, 1, 5),
        time: '10:00 AM',
        location: 'St. Mary\'s Church',
        type: 'appointment',
        attendees: 15
    },
    {
        id: '2',
        title: 'Wedding Ceremony',
        date: new Date(2026, 1, 7),
        time: '2:00 PM',
        location: 'Holy Family Cathedral',
        type: 'appointment',
        attendees: 50
    },
    {
        id: '3',
        title: 'First Communion Class',
        date: new Date(2026, 1, 8),
        time: '9:00 AM',
        location: 'Sacred Heart Parish',
        type: 'event',
        attendees: 20
    },
    {
        id: '4',
        title: 'Confirmation Ceremony',
        date: new Date(2026, 1, 10),
        time: '11:00 AM',
        location: 'St. Joseph Cathedral',
        type: 'appointment',
        attendees: 30
    },
];

export default function UpcomingEventsTimeline() {
    const getEventTypeColor = (type: Event['type']) => {
        switch (type) {
            case 'appointment':
                return 'bg-blue-100 text-blue-600 border-blue-200';
            case 'event':
                return 'bg-purple-100 text-purple-600 border-purple-200';
            case 'announcement':
                return 'bg-yellow-100 text-yellow-600 border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Upcoming Events</h2>
            </div>

            <div className="space-y-4">
                {MOCK_EVENTS.length > 0 ? (
                    MOCK_EVENTS.map((event) => (
                        <div
                            key={event.id}
                            className="relative pl-8 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0"
                        >
                            {/* Timeline Dot */}
                            <div className="absolute left-0 top-0 -translate-x-[9px] w-4 h-4 rounded-full bg-primary border-2 border-white shadow-sm" />

                            {/* Event Card */}
                            <div className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full border ${getEventTypeColor(event.type)}`}>
                                        {event.type}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>{format(event.date, 'EEEE, MMMM d, yyyy')}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>{event.time}</span>
                                    </div>

                                    {event.location && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            <span>{event.location}</span>
                                        </div>
                                    )}

                                    {event.attendees && (
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            <span>{event.attendees} attendees</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No upcoming events</p>
                    </div>
                )}
            </div>

            {MOCK_EVENTS.length > 0 && (
                <button className="w-full mt-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors">
                    View All Events
                </button>
            )}
        </div>
    );
}
