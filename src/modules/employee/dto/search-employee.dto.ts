import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SearchEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,20}$/)
  idNumber!: string;
}
