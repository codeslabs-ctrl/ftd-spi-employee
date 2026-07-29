import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateReentryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numIden!: string;

  /** Lo que el caller cree que es, ANTES de validar contra EO_PERSONA/TA_RELACION_LABORAL. */
  @IsIn(['SI', 'NO'])
  reingreso!: 'SI' | 'NO';
}
