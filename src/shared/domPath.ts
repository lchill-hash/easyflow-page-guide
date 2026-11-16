const DOM_PATH_PATTERN =
  /^[a-z][a-z0-9-]*(?::nth-of-type\(\d{1,4}\))?(?: > [a-z][a-z0-9-]*(?::nth-of-type\(\d{1,4}\))?)*$/;

export function buildDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current !== null && parts.length < 12) {
    const tagName = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    let index = 1;
    if (parent !== null) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === current) {
          break;
        }
        if (sibling.tagName === current.tagName) {
          index += 1;
        }
      }
    }
    parts.unshift(`${tagName}:nth-of-type(${index})`);
    current = parent;
  }
  return parts.join(" > ");
}

export function isValidDomPath(path: string): boolean {
  return path.length > 0 && path.length <= 512 && DOM_PATH_PATTERN.test(path);
}

export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripPunctuation(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}