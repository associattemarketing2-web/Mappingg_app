// Display form of a developer name ("KRISALA DEVELOPERS" → "Krisala Developers").
// Same rules as the website (lib/seo/developer-name.ts). Display only — slugify()
// ignores case, so slugs and links don't change.

const KEEP_UPPER = new Set(['LLP', 'LLC', 'SSPL', 'PCPL', 'DLF', 'NCC', 'NPS', 'VTP', 'ADI', 'GRC', 'TCG', 'HDIL', 'MHADA', 'CIDCO', 'II', 'III']);
const LOWER_WORDS = new Set(['and', 'of', 'by', 'the', 'at']);
// Company-form abbreviations have no vowels but are not acronyms.
const ABBREVIATIONS: Record<string, string> = { PVT: 'Pvt', 'PVT.': 'Pvt.', LTD: 'Ltd', 'LTD.': 'Ltd.' };

export function displayDeveloperName(raw?: string): string {
  const name = (raw || '').replace(/\s+/g, ' ').trim();
  // "M/s. KNS INFRA PLOTLUXE LLP": the honorific is mixed case, the name is not.
  const ms = /^(m\/s\.?)\s+(.+)$/i.exec(name);
  if (ms) return `${ms[1]!.endsWith('.') ? 'M/s.' : 'M/s'} ${displayDeveloperName(ms[2])}`;
  if (!name || name !== name.toUpperCase() || !/[A-Z]{3}/.test(name)) return name;
  return name
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part) => {
          const abbr = ABBREVIATIONS[part];
          if (abbr) return abbr;
          const lower = part.toLowerCase();
          if (i > 0 && LOWER_WORDS.has(lower)) return lower;
          if (KEEP_UPPER.has(part) || (part.length <= 4 && !/[AEIOU]/.test(part))) return part;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}

/** "SIGNATURE GLOBAL CITY 37D EXTN." → "Signature Global City 37D Extn." (website: displayProjectName). */
export const displayProjectName = (raw?: string): string => displayDeveloperName(raw);

/**
 * A locality typed in capitals: "VILLAGE- GADAULI KALAN" → "Village Gadauli Kalan",
 * "SECTOR- 76" → "Sector 76" (website: displayPlaceName). Same slug either way.
 */
export function displayPlaceName(raw?: string): string {
  const name = (raw || '').replace(/\s+-\s*|\s*-\s+/g, ' ').replace(/\s+/g, ' ').trim();
  return displayDeveloperName(name);
}
