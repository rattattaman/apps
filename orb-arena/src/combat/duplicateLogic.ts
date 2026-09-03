export interface DuplicateEntity {
  id: string;
  alive: boolean;
  duplicateOwnerId?: string;
}

export function linkedDuplicates<T extends DuplicateEntity>(fighters: T[], originalId: string): T[] {
  return fighters.filter((fighter) => fighter.alive && fighter.duplicateOwnerId === originalId);
}

export function livingContenderIds(fighters: DuplicateEntity[]): Set<string> {
  return new Set(
    fighters
      .filter((fighter) => fighter.alive)
      .map((fighter) => fighter.duplicateOwnerId ?? fighter.id),
  );
}
