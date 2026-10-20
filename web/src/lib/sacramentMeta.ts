import { BookOpen, Cross, Droplet, Flame, Gem, Heart, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react';

export type SacramentKey =
    | 'mass'
    | 'baptism'
    | 'confirmation'
    | 'marriage'
    | 'funeral'
    | 'anointing'
    | 'counseling'
    | 'other';

export interface SacramentMeta {
    key: SacramentKey;
    /** Full liturgical name, e.g. "Anointing of the Sick" */
    title: string;
    /** Short chip label, e.g. "Anointing" */
    chipLabel: string;
    /** Label for the notes block attached to a celebration */
    noteLabel: string;
    icon: LucideIcon;
}

const META: Record<SacramentKey, Omit<SacramentMeta, 'key'>> = {
    mass: { title: 'Mass intention', chipLabel: 'Mass', noteLabel: 'Mass intention', icon: BookOpen },
    baptism: { title: 'Baptism', chipLabel: 'Baptism', noteLabel: 'Ceremony details', icon: Droplet },
    confirmation: { title: 'Confirmation', chipLabel: 'Confirmation', noteLabel: 'Ceremony details', icon: Flame },
    marriage: { title: 'Holy Matrimony', chipLabel: 'Marriage', noteLabel: 'Ceremony details', icon: Gem },
    funeral: { title: 'Funeral Mass', chipLabel: 'Funeral', noteLabel: 'Ceremony details', icon: Cross },
    anointing: { title: 'Anointing of the Sick', chipLabel: 'Anointing', noteLabel: 'Pastoral note', icon: Heart },
    counseling: { title: 'Pastoral counseling', chipLabel: 'Counseling', noteLabel: 'Pastoral note', icon: MessageCircle },
    other: { title: 'Blessing', chipLabel: 'Other', noteLabel: 'Pastoral note', icon: Sparkles },
};

/** Sacrament keys shown as filter chips on the priest dashboard, in display order */
export const SACRAMENT_FILTER_KEYS: SacramentKey[] = ['mass', 'baptism', 'confirmation', 'marriage', 'funeral', 'anointing'];

export function getSacramentKey(serviceType: string | null | undefined): SacramentKey {
    const type = (serviceType || '').toLowerCase();
    if (type.includes('bapt')) return 'baptism';
    if (type.includes('confir')) return 'confirmation';
    if (type.includes('wed') || type.includes('marri') || type.includes('matrim') || type.includes('prenup')) return 'marriage';
    if (type.includes('fun') || type.includes('burial')) return 'funeral';
    if (type.includes('anoint') || type.includes('sick')) return 'anointing';
    if (type.includes('counsel') || type.includes('spiritual') || type.includes('confess') || type.includes('reconcil')) return 'counseling';
    if (type.includes('mass') || type.includes('intent')) return 'mass';
    return 'other';
}

export function getSacramentMeta(serviceType: string | null | undefined): SacramentMeta {
    const key = getSacramentKey(serviceType);
    const meta = { key, ...META[key] };
    // Keep the original wording for unmapped types such as "Blessing"
    if (key === 'other' && serviceType) {
        const label = serviceType.charAt(0).toUpperCase() + serviceType.slice(1).replace(/_/g, ' ');
        return { ...meta, title: label, chipLabel: label };
    }
    return meta;
}
