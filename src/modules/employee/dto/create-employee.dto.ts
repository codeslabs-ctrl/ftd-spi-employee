import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,20}$/)
  idNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  idType?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nationality!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  passport?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(17)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(17)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  secondLastName?: string;

  @IsDateString()
  birthDate!: string;

  @IsIn(['M', 'F'])
  gender!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  mobile?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(60)
  email?: string;
}
