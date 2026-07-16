import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListJobPostsDto {
  @IsOptional()
  @IsString()
  @MaxLength(4)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unitId?: string;

  /** API.docx: búsqueda por empresa + unidad + cargo */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  positionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;
}
