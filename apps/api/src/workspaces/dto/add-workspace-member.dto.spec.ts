import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddWorkspaceMemberDto } from './add-workspace-member.dto';

describe('AddWorkspaceMemberDto', () => {
  it('DTO validation still accepts only owner and member', async () => {
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

    const invalidErrors = await validate(invalidDto);

    expect(ownerDto.email).toBe('owner@example.com');
    expect(memberDto.email).toBe('member@example.com');
    expect(invalidErrors).toHaveLength(1);
    expect(invalidErrors[0]?.property).toBe('role');
  });
});
