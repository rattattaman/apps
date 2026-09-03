import { describe, expect, it } from 'vitest';
import { linkedDuplicates, livingContenderIds, type DuplicateEntity } from './duplicateLogic';

const group: DuplicateEntity[] = [
  { id: 'original', alive: true },
  { id: 'copy-1', alive: true, duplicateOwnerId: 'original' },
  { id: 'copy-2', alive: true, duplicateOwnerId: 'original' },
  { id: 'rival', alive: true },
];

describe('familia de Duplicador', () => {
  it('vincula todas las copias únicamente a su original', () => {
    expect(linkedDuplicates(group, 'original').map((fighter) => fighter.id)).toEqual(['copy-1', 'copy-2']);
    expect(linkedDuplicates(group, 'rival')).toEqual([]);
  });

  it('considera al original y sus copias un único contendiente', () => {
    expect([...livingContenderIds(group)]).toEqual(['original', 'rival']);
    expect([...livingContenderIds(group.filter((fighter) => fighter.id !== 'rival'))]).toEqual(['original']);
  });
});
