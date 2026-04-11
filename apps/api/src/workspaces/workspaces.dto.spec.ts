import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { TransferWorkspaceOwnershipDto } from './dto/transfer-workspace-ownership.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { UpdateWorkspaceShareLinkDto } from './dto/update-workspace-share-link.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

describe('Workspace member DTOs', () => {
  it('accepts only owner and member when inviting a workspace member', async () => {
    const ownerDto = plainToInstance(AddWorkspaceMemberDto, {
      email: ' owner@example.com ',
      role: 'owner',
    });
    const memberDto = plainToInstance(AddWorkspaceMemberDto, {
      email: ' member@example.com ',
      role: 'member',
    });
    const invalidDto = plainToInstance(AddWorkspaceMemberDto, {
      email: 'viewer@example.com',
      role: 'viewer',
    });

    await expect(validate(ownerDto)).resolves.toHaveLength(0);
    await expect(validate(memberDto)).resolves.toHaveLength(0);
    expect(ownerDto.email).toBe('owner@example.com');
    expect(memberDto.email).toBe('member@example.com');
    await expect(validate(invalidDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
    );
  });

  it('accepts only owner and member when updating a workspace member role', async () => {
    const ownerDto = plainToInstance(UpdateWorkspaceMemberDto, { role: 'owner' });
    const memberDto = plainToInstance(UpdateWorkspaceMemberDto, { role: 'member' });
    const invalidDto = plainToInstance(UpdateWorkspaceMemberDto, { role: 'viewer' });

    await expect(validate(ownerDto)).resolves.toHaveLength(0);
    await expect(validate(memberDto)).resolves.toHaveLength(0);
    await expect(validate(invalidDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
    );
  });

  it('accepts only member when updating a workspace share link role', async () => {
    const memberDto = plainToInstance(UpdateWorkspaceShareLinkDto, { role: 'member' });
    const ownerDto = plainToInstance(UpdateWorkspaceShareLinkDto, { role: 'owner' });
    const invalidDto = plainToInstance(UpdateWorkspaceShareLinkDto, { role: 'viewer' });

    await expect(validate(memberDto)).resolves.toHaveLength(0);
    await expect(validate(ownerDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
    );
    await expect(validate(invalidDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
    );
  });

  it('normalizes and validates workspace name updates', async () => {
    const validDto = plainToInstance(UpdateWorkspaceDto, {
      name: '  Product    Team  ',
    });
    const tooShortDto = plainToInstance(UpdateWorkspaceDto, {
      name: 'a',
    });

    await expect(validate(validDto)).resolves.toHaveLength(0);
    expect(validDto.name).toBe('Product Team');
    await expect(validate(tooShortDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'name' })]),
    );
  });

  it('requires a valid uuid for ownership transfers', async () => {
    const validDto = plainToInstance(TransferWorkspaceOwnershipDto, {
      nextOwnerUserId: '11111111-1111-4111-8111-111111111111',
    });
    const invalidDto = plainToInstance(TransferWorkspaceOwnershipDto, {
      nextOwnerUserId: 'not-a-uuid',
    });

    await expect(validate(validDto)).resolves.toHaveLength(0);
    await expect(validate(invalidDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'nextOwnerUserId' })]),
    );
  });
});
