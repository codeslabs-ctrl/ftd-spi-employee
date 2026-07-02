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

// Field lengths match INFOCENT.EO_PERSONA columns (see db/pkg_management_employee_api.sql)
export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9A-Za-z-]{1,20}$/)
  idNumber: string; // NUM_IDEN

  @IsOptional()
  @IsString()
  @MaxLength(2)
  idType?: string; // ID_TIPO_IDEN

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nationality: string; // NACIONAL

  @IsOptional()
  @IsString()
  @MaxLength(10)
  passport?: string; // PASAPORTE

  @IsString()
  @IsNotEmpty()
  @MaxLength(17)
  firstName: string; // NOMBRE1

  @IsOptional()
  @IsString()
  @MaxLength(15)
  middleName?: string; // NOMBRE2

  @IsString()
  @IsNotEmpty()
  @MaxLength(17)
  lastName: string; // APELLIDO1

  @IsOptional()
  @IsString()
  @MaxLength(15)
  secondLastName?: string; // APELLIDO2

  @IsDateString()
  birthDate: string; // FECHA_NA

  @IsIn(['M', 'F'])
  gender: string; // SEXO ('1'=M, '2'=F — translated in the PKG)

  @IsOptional()
  @IsString()
  @MaxLength(30)
  maritalStatus?: string; // EDO_CIVIL

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string; // DIRECCION

  @IsOptional()
  @IsString()
  @MaxLength(30)
  city?: string; // CIUDAD

  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string; // TELEFONO1

  @IsOptional()
  @IsString()
  @MaxLength(15)
  mobile?: string; // CELULAR

  @IsOptional()
  @IsEmail()
  @MaxLength(60)
  email?: string; // E_MAIL1
}
