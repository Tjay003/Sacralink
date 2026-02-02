// Mock trend data for dashboard statistics
export const mockTrendData = {
    totalUsers: {
        value: 40689,
        trend: { value: 8.5, isUp: true, label: 'Up from yesterday' }
    },
    totalChurches: {
        value: 127,
        trend: { value: 3.2, isUp: true, label: 'Up from last week' }
    },
    pendingRequests: {
        value: 18,
        trend: { value: 12.4, isUp: false, label: 'Down from yesterday' }
    },
    upcomingEvents: {
        value: 54,
        trend: { value: 15.8, isUp: true, label: 'Up from last week' }
    },
    userUpcoming: {
        value: 3,
        trend: { value: 50, isUp: true, label: 'Up from last month' }
    },
    userPending: {
        value: 2,
        trend: { value: 0, isUp: true, label: 'No change' }
    },
    userTotalBookings: {
        value: 12,
        trend: { value: 20, isUp: true, label: 'Up from last month' }
    }
};
