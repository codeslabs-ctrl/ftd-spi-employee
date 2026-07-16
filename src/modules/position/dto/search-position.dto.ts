import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchPositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id!: string;
}
