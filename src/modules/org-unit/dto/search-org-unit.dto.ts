import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchOrgUnitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  id!: string;
}
