import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  id!: string;
}
