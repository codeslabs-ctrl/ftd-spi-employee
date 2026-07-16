import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  classificationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  parentPositionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  functions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  risk?: string;
}
