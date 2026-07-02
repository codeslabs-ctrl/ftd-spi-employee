import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Field set assumed from prc_crear_datos_basicos — locked once Task 0 confirms the real signature
export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5,10}$/)
  idNumber: string;

  @IsIn(['V', 'E'])
  nationality: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondLastName?: string;

  @IsDateString()
  birthDate: string;

  @IsIn(['M', 'F'])
  gender: string;
}
