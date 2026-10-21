import { describe, expect, it, vi } from 'vitest';

import { candidateGroups, publishForGroup, siteAddress, unpublishForGroup } from './publish';

const deps = () => ({
  createApplication: vi.fn().mockResolvedValue({ id: 'app1', roleId: 'role1' }),
  authorize: vi.fn().mockResolvedValue(undefined),
  unauthorize: vi.fn().mockResolvedValue(undefined),
});

describe('siteAddress', () => {
  it('privé et public', () => {
    expect(siteAddress({ _id: 'abc' })).toBe('/pages#/website/abc');
    expect(siteAddress({ _id: 'abc', visibility: 'PUBLIC' })).toBe('/pages/p/website#/website/abc');
  });
});

describe('candidateGroups', () => {
  const groups = [{ id: 'g1', name: 'Élèves 6A' }, { id: 'g2', name: 'Enseignants' }, { id: 'g3', name: 'Parents' }];
  it('exclut les groupes déjà publiés et trie', () => {
    const pub = { application: { id: 'a' }, role: { id: 'r' }, groups: [{ id: 'g2', name: 'Enseignants' }] };
    expect(candidateGroups(groups, pub, '').map((g) => g.id)).toEqual(['g1', 'g3']);
  });
  it('recherche sans accents ni casse', () => {
    expect(candidateGroups(groups, undefined, 'eleves').map((g) => g.id)).toEqual(['g1']);
  });
});

describe('publishForGroup', () => {
  const site = { _id: 's1', title: 'Mon site', visibility: 'PRIVATE', published: undefined };
  it('crée l\'application au premier groupe puis autorise le groupe', async () => {
    const d = deps();
    const out = await publishForGroup(site, 'st1', { id: 'g1', name: 'Élèves' }, d);
    expect(d.createApplication).toHaveBeenCalledWith('st1', expect.objectContaining({ displayName: 'Mon site', address: '/pages#/website/s1' }));
    expect(d.authorize).toHaveBeenCalledWith('g1', 'role1');
    expect(out.st1).toEqual({ application: { id: 'app1' }, role: { id: 'role1' }, groups: [{ id: 'g1', name: 'Élèves' }] });
  });
  it('réutilise l\'application existante pour un second groupe', async () => {
    const d = deps();
    const first = await publishForGroup(site, 'st1', { id: 'g1', name: 'A' }, d);
    const second = await publishForGroup({ ...site, published: first }, 'st1', { id: 'g2', name: 'B' }, d);
    expect(d.createApplication).toHaveBeenCalledTimes(1);
    expect(second.st1.groups.map((g) => g.id)).toEqual(['g1', 'g2']);
  });
  it('ne publie pas si l\'autorisation échoue', async () => {
    const d = deps();
    d.authorize.mockRejectedValue(new Error('403'));
    await expect(publishForGroup(site, 'st1', { id: 'g1', name: 'A' }, d)).rejects.toThrow('403');
  });
});

describe('unpublishForGroup', () => {
  it('retire le groupe et son autorisation', async () => {
    const d = deps();
    const published = { st1: { application: { id: 'a' }, role: { id: 'r' }, groups: [{ id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }] } };
    const out = await unpublishForGroup({ published }, 'st1', 'g1', d);
    expect(d.unauthorize).toHaveBeenCalledWith('g1', 'r');
    expect(out.st1.groups.map((g) => g.id)).toEqual(['g2']);
  });
});
