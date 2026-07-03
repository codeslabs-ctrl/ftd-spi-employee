import { IsNotEmpty, IsString, Matches } from 'class-validator';

// Body for POST /employees/search — keeps the identifier (cédula) out of the URL.
export class SearchEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,20}$/)
  idNumber: string;
}
