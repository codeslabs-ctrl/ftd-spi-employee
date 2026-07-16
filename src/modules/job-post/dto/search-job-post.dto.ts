import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchJobPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  unitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id!: string;
}
