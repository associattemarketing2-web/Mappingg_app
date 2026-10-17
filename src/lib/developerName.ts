// Display form of a developer name ("KRISALA DEVELOPERS" → "Krisala Developers").
// Same rules as the website (lib/seo/developer-name.ts). Display only.

const KEEP_UPPER = new Set(['LLP', 'LLC', 'SSPL', 'PCPL', 'DLF', 'NCC', 'NPS', 'VTP', 'ADI', 'GRC', 'TCG', 'HDIL', 'MHADA', 'CIDCO', 'II', 'III']);
const LOWER_WORDS = new Set(['and', 'of', 'by', 'the', 'at']);

export function displayDeveloperName(raw?: string): string {
  const name = (raw || '').replace(/\s+/g, ' ').trim();
  if (!name || name !== name.toUpperCase() || !/[A-Z]{3}/.test(name)) return name;
  return name
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part) => {
          if (KEEP_UPPER.has(part) || (part.length <= 4 && !/[AEIOU]/.test(part))) return part;
          const lower = part.toLowerCase();
          if (i > 0 && LOWER_WORDS.has(lower)) return lower;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}
