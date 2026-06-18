import { createEntityId, normalizeUsername } from './entity-id.util';

describe('entity id utilities', () => {
  it('creates underscore-prefixed entity identifiers', () => {
    const id = createEntityId('Sales Contract');

    expect(id).toMatch(/^_sales_contract_\d{8}_[a-z0-9]{8}$/);
  });

  it('normalizes usernames without relying on email identity', () => {
    expect(normalizeUsername(' Nguyen Van Admin ')).toBe('nguyen.van.admin');
  });
});
