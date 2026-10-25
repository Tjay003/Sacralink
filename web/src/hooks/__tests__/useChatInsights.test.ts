import { test, expect } from '@playwright/test';
import { isUnansweredQuery, generateFaqDraft } from '../useChatInsights';

test.describe('Ticket 05: useChatInsights (Unit Tests)', () => {
    test('correctly identifies unanswered / low-confidence replies containing fallback markers', () => {
        const fallbackReplies = [
            'Please contact the parish office for further details.',
            'Makipag-ugnayan sa tanggapan ng parokya ukol dito.',
            'Hindi ko po tiyak ang patakaran ukol sa usaping ito.',
            'Hindi ko po alam ang detalye ng crypt.',
            'There is no information available in the knowledge base.',
            'Wala pong impormasyon tungkol sa parish hall.',
            'offline-fallback: please reach out to parish administration',
            'I do not have information about parish hall rentals. Please contact the parish office.',
            'Reach out to the parish office for official assistance.',
        ];

        for (const reply of fallbackReplies) {
            expect(isUnansweredQuery(reply)).toBe(true);
        }
    });

    test('correctly identifies high-confidence answered replies as answered', () => {
        const answeredReplies = [
            'The Sunday Mass schedule is 6:00 AM, 8:00 AM, and 5:00 PM.',
            'Baptism requirements include the child\'s PSA Birth Certificate and parents\' Catholic Marriage Contract.',
            'The parish office is open Tuesday to Sunday from 8:00 AM to 5:00 PM.',
            'Yes, Father John is available for confession on Saturday at 4:00 PM.',
        ];

        for (const reply of answeredReplies) {
            expect(isUnansweredQuery(reply)).toBe(false);
        }
    });

    test('generateFaqDraft creates clean titles and structured pastoral markdown', () => {
        const draft1 = generateFaqDraft(
            'Can we rent the parish hall for receptions?',
            'I do not have information about parish hall rentals. Please contact the parish office.'
        );
        expect(draft1.title).toContain('Parish Hall Rentals');
        expect(draft1.draftContent).toContain('Frequently Asked Question');
        expect(draft1.draftContent).toContain('Can we rent the parish hall for receptions?');
        expect(draft1.draftContent).toContain('Pastoral Guidance & Parish Policy');

        const draft2 = generateFaqDraft('How much is the crypt niche or columbarium?');
        expect(draft2.title).toContain('Columbarium');
        expect(draft2.draftContent).toContain('Frequently Asked Question');

        const draft3 = generateFaqDraft('Can non-parishioners get married in this church?');
        expect(draft3.title).toContain('Wedding Requirements');

        const draft4 = generateFaqDraft('May binyag ba tuwing Sabado?');
        expect(draft4.title).toContain('Baptism Requirements');
    });
});
