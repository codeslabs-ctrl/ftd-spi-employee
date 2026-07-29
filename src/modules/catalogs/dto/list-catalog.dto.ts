import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * DTO único para los 18 catálogos de "list" (mismo factory de controller
 * para todos, ver catalogs.controller.ts). Además de page/size, whitelistea
 * los filtros OPCIONALES que ya existen del lado Oracle (PRC_PARSE_*_FILTER
 * en db/pkg_management_catalogs_api.sql) pero que hasta 2026-07-29 nunca se
 * habían expuesto aquí — sin esto, class-validator los rechazaba con 400
 * "property X should not exist" antes de que el request llegara a Oracle.
 * No todos los catálogos usan todos los filtros; el que no aplica para un
 * catálogo dado simplemente se ignora del lado Oracle (JSON_TABLE solo lee
 * las rutas que declara cada PRC_PARSE_*_FILTER).
 */
export class ListCatalogDto {
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

  /** localities, payroll-types, groups, branches, banks, pension-funds, health-providers, compensation-funds, severance-funds */
  @IsOptional()
  @IsString()
  @MaxLength(4)
  companyId?: string;

  /** states, municipalities */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  /** municipalities */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  stateCode?: string;

  /** parishes */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  municipalityId?: string;

  /** groups */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  payrollTypeCode?: string;
}
