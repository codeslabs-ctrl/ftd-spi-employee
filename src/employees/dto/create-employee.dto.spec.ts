import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

const valid = {
  idNumber: '12345678',
  nationality: 'V',
  firstName: 'MARIA',
  lastName: 'PEREZ',
  birthDate: '1990-05-14',
  gender: 'F',
};

describe('CreateEmployeeDto', () => {
  it('accepts a valid payload', async () => {
    expect(
      await validate(plainToInstance(CreateEmployeeDto, valid)),
    ).toHaveLength(0);
  });

  it('rejects empty idNumber and invalid gender', async () => {
    const errors = await validate(
      plainToInstance(CreateEmployeeDto, {
        ...valid,
        idNumber: '',
        gender: 'X',
      }),
    );
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['idNumber', 'gender']));
  });

  it('rejects invalid birthDate', async () => {
    const errors = await validate(
      plainToInstance(CreateEmployeeDto, { ...valid, birthDate: 'not-a-date' }),
    );
    expect(errors.map((e) => e.property)).toContain('birthDate');
  });
});
