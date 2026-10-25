/**
 * Utility functions for church formatting and display.
 */

/**
 * Extracts a patron saint or title from a church name.
 * Handles prefixes (e.g. "Quasi-Parish of Our Lady of La Salette." -> "Our Lady of La Salette")
 * and suffixes (e.g. "Sacred Heart of Jesus Parish" -> "Sacred Heart of Jesus",
 * "San Isidro Labrador Parish Muzon" -> "San Isidro Labrador",
 * "Our Lady of Perpetual Help Quasi-Parish" -> "Our Lady of Perpetual Help").
 */
export function extractPatronSaint(churchName?: string | null): string {
    if (!churchName) return 'Holy Patron';

    const name = churchName.trim().replace(/[.,;]+$/, '').trim();

    // 1. Prefix pattern:
    // "Quasi-Parish of [Patron]"
    // "Parish of [Patron]"
    // "Diocesan Shrine and Parish of [Patron]"
    // "Minor Basilica of [Patron]"
    const prefixRegex =
        /^(?:(?:Diocesan|National|Archdiocesan)\s+)?(?:Shrine\s+(?:and|&)\s+)?(?:Minor\s+)?(?:Quasi-)?(?:Parish|Shrine|Cathedral|Basilica|Chapel|Church)(?:\s+(?:and|&)\s+(?:Quasi-)?(?:Parish|Shrine))?\s+of\s+(.+)$/i;
    const prefixMatch = name.match(prefixRegex);
    if (prefixMatch && prefixMatch[1]?.trim()) {
        return prefixMatch[1].trim();
    }

    // 2. Suffix pattern:
    // "[Patron] Quasi-Parish"
    // "[Patron] Parish"
    // "[Patron] Parish [Location]"
    const suffixRegex = /^(.*?)\s+(?:Quasi-Parish|Parish|Cathedral|Basilica|Chapel)(?:\s+.*)?$/i;
    const suffixMatch = name.match(suffixRegex);
    if (suffixMatch && suffixMatch[1]?.trim()) {
        return suffixMatch[1].trim();
    }

    return name || 'Holy Patron';
}
