import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger';
import { CreateEmployeeDto } from './create-employee.dto';

// Body for POST /employees/update: idNumber required (identifies the record, in the
// body — not the URL) + all other fields optional. Reuses CreateEmployeeDto.
export class UpdateEmployeeDto extends IntersectionType(
  PickType(CreateEmployeeDto, ['idNumber'] as const),
  PartialType(OmitType(CreateEmployeeDto, ['idNumber'] as const)),
) {}
