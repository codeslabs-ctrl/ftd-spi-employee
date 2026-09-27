import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toBooleanDefaultTrue } from '../../../shared/utils/to-boolean.util';

export class ListOrgUnitsDto {
  @IsOptional()
  @IsString()
  @MaxLength(4)
  companyId?: string;

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

  /**
   * true (default) = paginado de siempre. false = ignora page/size y
   * devuelve todas las unidades organizativas en un solo response.
   */
  @IsOptional()
  @Transform(({ obj }) => toBooleanDefaultTrue(obj.paginate))
  @IsBoolean()
  paginate: boolean = true;
}
