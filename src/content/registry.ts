import type { ItemType } from "../shared/types";

interface Registration {
  elementId: string;
  type: ItemType;
  textHash: string;
}

export interface RegisteredElement {
  element: Element;
  textHash: string;
}

const PREFIX: Record<ItemType, string> = {
  heading: "h",
  paragraph: "p",
  link: "l",
  button: "b",
  inputLabel: "i",
};

const counters: Record<ItemType, number> = {
  heading: 0,
  paragraph: 0,
  link: 0,
  button: 0,
  inputLabel: 0,
};

const registrations = new WeakMap<Element, Registration>();
const elementsById = new Map<string, Element>();

export function getOrCreateRegistration(
  element: Element,
  type: ItemType,
  hash: string,
): Registration {
  const existing = registrations.get(element);
  if (existing !== undefined && existing.type === type) {
    existing.textHash = hash;
    return existing;
  }
  counters[type] += 1;
  const registration: Registration = {
    elementId: `ef-${PREFIX[type]}-${counters[type]}`,
    type,
    textHash: hash,
  };
  registrations.set(element, registration);
  elementsById.set(registration.elementId, element);
  return registration;
}

export function lookup(elementId: string): RegisteredElement | undefined {
  const element = elementsById.get(elementId);
  if (element === undefined) {
    return undefined;
  }
  const registration = registrations.get(element);
  return {
    element,
    textHash: registration?.textHash ?? "",
  };
}

export function resetIfStale(): void {
  for (const [elementId, element] of elementsById) {
    if (!element.isConnected) {
      elementsById.delete(elementId);
    }
  }
}

export function clearRegistry(): void {
  elementsById.clear();
}