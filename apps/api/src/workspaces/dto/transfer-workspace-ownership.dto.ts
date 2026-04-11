import { IsUUID } from 'class-validator';

export class TransferWorkspaceOwnershipDto {
  @IsUUID()
  nextOwnerUserId!: string;
}
